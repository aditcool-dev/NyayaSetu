"""
MODULE 6.5: CASE-LEVEL ANALYSIS
================================
Extracts case-level metadata: summary, legal takeaway, and departmental impact.

WHY a separate module:
- Directive extraction (Module 6) works on chunks for token efficiency.
- Case-level analysis needs the FULL judgment context for accurate summary.
- We use the cleaned full text (not chunks) to generate holistic insights.

This module runs AFTER directive extraction to provide:
1. AI Summary: High-level overview of the case
2. Legal Takeaway: Key legal principle or precedent
3. Departmental Impact: Which departments are affected and how

PROMPT DESIGN:
- Focused on insights, not directives
- Asks for concise, actionable summaries
- Calibrated for Indian legal context
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

CASE_ANALYSIS_PROMPT = """You are an expert Indian legal analyst. Analyze the following court judgment and provide:

1. **AI Summary** (2-3 sentences): A concise overview of what this case is about, the key issue, and the court's decision.

2. **Legal Takeaway** (1-2 sentences): The key legal principle, precedent, or interpretation established by this judgment. What should legal professionals remember from this case?

3. **Departmental Impact** (2-3 sentences): Which government departments or authorities are affected by this judgment? What actions or policy changes might they need to consider?

Return ONLY a JSON object with this exact structure:
{{
  "summary": "string - 2-3 sentence case overview",
  "legal_takeaway": "string - key legal principle",
  "departmental_impact": "string - affected departments and implications"
}}

CASE METADATA:
{metadata}

JUDGMENT TEXT (cleaned):
{text}

Return the JSON object:"""


async def analyze_case_async(
    full_text: str,
    metadata: Dict[str, Any],
    max_retries: int = 3,
) -> Dict[str, Any]:
    """
    Extract case-level insights using the full judgment text.

    Args:
        full_text: Complete cleaned judgment text
        metadata: Case metadata (case_no, court, judgment_date, etc.)
        max_retries: Number of retry attempts for API calls

    Returns:
        {
            "summary": str,
            "legal_takeaway": str,
            "departmental_impact": str,
            "elapsed_sec": float
        }
    """
    start_time = time.time()
    
    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        logger.error(f"Failed to import google.genai: {e}")
        return {
            "summary": "Case analysis unavailable - google.genai not installed",
            "legal_takeaway": None,
            "departmental_impact": None,
            "elapsed_sec": 0.0,
        }

    api_key = os.getenv("GEMINI_API_KEY", "").strip(' "\'')
    if not api_key:
        logger.error("GEMINI_API_KEY not set - cannot perform case analysis")
        return {
            "summary": "Case analysis unavailable - API key not configured",
            "legal_takeaway": None,
            "departmental_impact": None,
            "elapsed_sec": 0.0,
        }

    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        logger.error(f"Failed to create Gemini client: {e}")
        return {
            "summary": f"Case analysis unavailable - client initialization failed: {str(e)}",
            "legal_takeaway": None,
            "departmental_impact": None,
            "elapsed_sec": 0.0,
        }

    # Truncate text if too long (keep first 50k chars for context)
    truncated_text = full_text[:50000] if len(full_text) > 50000 else full_text

    prompt = CASE_ANALYSIS_PROMPT.format(
        metadata=json.dumps(metadata, indent=2),
        text=truncated_text,
    )

    for attempt in range(max_retries):
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        top_p=0.95,
                        max_output_tokens=1024,
                        response_mime_type="application/json",
                    ),
                )
            )

            result = json.loads(response.text.strip())
            elapsed = round(time.time() - start_time, 2)

            logger.info(f"Case analysis complete in {elapsed}s")

            return {
                "summary": result.get("summary", ""),
                "legal_takeaway": result.get("legal_takeaway"),
                "departmental_impact": result.get("departmental_impact"),
                "elapsed_sec": elapsed,
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse case analysis JSON response: {e}")
            if attempt < max_retries - 1:
                wait_time = 5 * (attempt + 1)
                logger.warning(f"Retrying in {wait_time}s ({attempt + 2}/{max_retries})")
                await asyncio.sleep(wait_time)
            else:
                elapsed = round(time.time() - start_time, 2)
                return {
                    "summary": "Case analysis failed - invalid JSON response from API",
                    "legal_takeaway": None,
                    "departmental_impact": None,
                    "elapsed_sec": elapsed,
                }
        except Exception as e:
            error_str = str(e)
            if "429" in error_str and attempt < max_retries - 1:
                wait_time = 30 * (2 ** attempt)
                logger.warning(
                    f"Case analysis rate limited (429). "
                    f"Waiting {wait_time}s before retry {attempt + 2}/{max_retries}"
                )
                await asyncio.sleep(wait_time)
            elif attempt < max_retries - 1:
                wait_time = 5 * (attempt + 1)
                logger.warning(
                    f"Case analysis error: {error_str}. "
                    f"Retrying in {wait_time}s ({attempt + 2}/{max_retries})"
                )
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Case analysis failed after {max_retries} retries: {e}")
                elapsed = round(time.time() - start_time, 2)
                return {
                    "summary": f"Case analysis failed: {str(e)}",
                    "legal_takeaway": None,
                    "departmental_impact": None,
                    "elapsed_sec": elapsed,
                }

    return {
        "summary": "Analysis failed - max retries exceeded",
        "legal_takeaway": None,
        "departmental_impact": None,
        "elapsed_sec": 0.0,
    }


def analyze_case_sync(
    full_text: str,
    metadata: Dict[str, Any],
    max_retries: int = 3,
) -> Dict[str, Any]:
    """
    Synchronous wrapper for analyze_case_async.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run,
                    analyze_case_async(full_text, metadata, max_retries)
                )
                return future.result()
        else:
            return loop.run_until_complete(
                analyze_case_async(full_text, metadata, max_retries)
            )
    except RuntimeError:
        return asyncio.run(analyze_case_async(full_text, metadata, max_retries))
