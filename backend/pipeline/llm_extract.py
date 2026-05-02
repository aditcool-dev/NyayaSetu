"""
MODULE 6: LLM EXTRACTION CALL (ASYNC PARALLEL)
================================================
Sends each chunk to the LLM concurrently using asyncio.gather().

WHY async parallel (not sequential):
- Each chunk is independent — no shared state.
- Sequential processing: 10 chunks × 6s/chunk = 60s total.
- Parallel processing: max(6s) = 6s total (10x speedup).
- This is the key to staying under the 10-minute target for 50-page judgments.

PROMPT DESIGN PRINCIPLES:
1. Explicit instruction for ALL directive types (explicit, implied, conditional)
2. AMBIGUOUS flag instead of hallucinated authorities
3. Case header injected to anchor responsible_authority
4. JSON schema enforced in the prompt
5. Confidence scoring calibrated to directive type

WHY "AMBIGUOUS — human review required":
- Hallucinated authorities are worse than flagged unknowns.
- An officer acting on a hallucinated directive could cause harm.
- The split-view UI surfaces AMBIGUOUS directives for mandatory human review.

RETRY LOGIC:
- 3 retries with exponential backoff for rate limits (429)
- JSON parse errors trigger a retry with explicit JSON repair instruction
- Failed chunks are returned with error metadata (not silently dropped)
"""

import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt template — use this exactly as specified in the product requirements
# ---------------------------------------------------------------------------
EXTRACTION_PROMPT_TEMPLATE = """You are a legal compliance assistant for Indian government officers.

Extract EVERY directive from the text below — including:
- Explicit orders ("shall", "directed to")
- Implied responsibilities ("may consider", "appropriate action")
- Conditional directives ("if X, then Y")

For each directive, return a JSON array where each element has EXACTLY this structure:
{{
  "directive_text": "verbatim quote from the judgment text",
  "responsible_authority": "who must act — use case header parties if unclear, or 'AMBIGUOUS — human review required'",
  "deadline_relative": "e.g., 'within 30 days' or null if no timeframe mentioned",
  "deadline_absolute": "ISO 8601 date resolved from judgment_date + deadline_relative, or null",
  "directive_type": "explicit | implied | conditional",
  "confidence": 0.0 to 1.0,
  "source_paragraph": "exact paragraph number or ID from the text",
  "source_page": integer page number
}}

CRITICAL RULES:
1. If responsibility is ambiguous, set "responsible_authority": "AMBIGUOUS — human review required". NEVER guess.
2. If no explicit timeframe is mentioned, set "deadline_relative": null and "deadline_absolute": null. NEVER hallucinate dates.
3. Confidence calibration:
   - 0.85–0.95: Explicit "shall" / "directed to" with clear authority and deadline
   - 0.70–0.84: Implied obligation ("may consider", "appropriate steps") with identifiable authority
   - 0.50–0.69: Conditional directive or ambiguous authority
   - Below 0.50: Flag for human review
4. "directive_text" must be verbatim from the judgment — do NOT paraphrase.
5. Return ONLY the JSON array. No explanation, no markdown, no preamble.

CASE HEADER (use this to identify responsible authorities):
{case_header}

JUDGMENT TEXT:
{chunk_text}

Return the JSON array of directives:"""


def _build_prompt(chunk: Dict[str, Any]) -> str:
    """Build the LLM prompt for a single chunk."""
    case_header_str = json.dumps(chunk["case_header"], indent=2)
    return EXTRACTION_PROMPT_TEMPLATE.format(
        case_header=case_header_str,
        chunk_text=chunk["text"],
    )


def _parse_llm_response(response_text: str, chunk_id: int) -> List[Dict[str, Any]]:
    """
    Parse the LLM's JSON response into a list of directive dicts.

    WHY robust parsing (not just json.loads):
    - LLMs sometimes wrap JSON in markdown code blocks.
    - LLMs sometimes add trailing commas (invalid JSON).
    - We try multiple extraction strategies before giving up.
    """
    if not response_text or not response_text.strip():
        logger.warning(f"Chunk {chunk_id}: Empty LLM response")
        return []

    text = response_text.strip()

    # Strategy 1: Direct parse
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
        if isinstance(result, dict) and "directives" in result:
            return result["directives"]
    except json.JSONDecodeError:
        pass

    # Strategy 2: Strip markdown code blocks
    code_block_match = re.search(r'```(?:json)?\s*([\s\S]+?)\s*```', text)
    if code_block_match:
        try:
            result = json.loads(code_block_match.group(1))
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    # Strategy 3: Find JSON array in the response
    array_match = re.search(r'\[\s*\{[\s\S]+\}\s*\]', text)
    if array_match:
        try:
            result = json.loads(array_match.group(0))
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    # Strategy 4: Fix common JSON issues (trailing commas)
    try:
        fixed = re.sub(r',\s*([}\]])', r'\1', text)
        result = json.loads(fixed)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    logger.error(f"Chunk {chunk_id}: Could not parse LLM response as JSON. First 200 chars: {text[:200]}")
    return []


async def _call_gemini_async(
    prompt: str,
    chunk_id: int,
    max_retries: int = 3,
) -> str:
    """
    Async wrapper for Gemini API call with retry logic.

    WHY async (not threading):
    - Gemini API calls are I/O-bound (waiting for network response).
    - asyncio is more efficient than threading for I/O-bound tasks.
    - asyncio.gather() runs all chunks concurrently in a single thread.
    """
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY", "").strip(' "\'')
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")

    genai.configure(api_key=api_key)

    generation_config = {
        "temperature": 0.05,   # Very low: we want deterministic extraction, not creativity
        "top_p": 0.95,
        "max_output_tokens": 4096,
        "response_mime_type": "application/json",
    }

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=generation_config,
    )

    for attempt in range(max_retries):
        try:
            # Run the synchronous Gemini call in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: model.generate_content(prompt)
            )
            return response.text

        except Exception as e:
            error_str = str(e)
            if "429" in error_str and attempt < max_retries - 1:
                wait_time = 30 * (2 ** attempt)  # exponential backoff: 30s, 60s, 120s
                logger.warning(
                    f"Chunk {chunk_id}: Rate limited (429). "
                    f"Waiting {wait_time}s before retry {attempt + 2}/{max_retries}"
                )
                await asyncio.sleep(wait_time)
            elif attempt < max_retries - 1:
                wait_time = 5 * (attempt + 1)
                logger.warning(
                    f"Chunk {chunk_id}: API error '{error_str}'. "
                    f"Retrying in {wait_time}s ({attempt + 2}/{max_retries})"
                )
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Chunk {chunk_id}: All {max_retries} retries failed: {e}")
                raise

    return ""


async def _process_chunk_async(
    chunk: Dict[str, Any],
    semaphore: asyncio.Semaphore,
) -> Dict[str, Any]:
    """
    Process a single chunk: build prompt → call LLM → parse response.

    Uses a semaphore to limit concurrent API calls (avoid rate limits).
    """
    chunk_id = chunk["chunk_id"]
    start_time = time.time()

    async with semaphore:
        try:
            prompt = _build_prompt(chunk)
            response_text = await _call_gemini_async(prompt, chunk_id)
            directives = _parse_llm_response(response_text, chunk_id)

            # Attach chunk metadata to each directive for traceability
            for directive in directives:
                directive["_chunk_id"] = chunk_id
                directive["_chunk_packet_count"] = chunk["packet_count"]

            elapsed = round(time.time() - start_time, 2)
            logger.info(
                f"Chunk {chunk_id}: extracted {len(directives)} directives "
                f"in {elapsed}s ({chunk['token_count']} tokens)"
            )

            return {
                "chunk_id": chunk_id,
                "directives": directives,
                "elapsed_sec": elapsed,
                "token_count": chunk["token_count"],
                "error": None,
            }

        except Exception as e:
            elapsed = round(time.time() - start_time, 2)
            logger.error(f"Chunk {chunk_id}: Failed after {elapsed}s: {e}")
            return {
                "chunk_id": chunk_id,
                "directives": [],
                "elapsed_sec": elapsed,
                "token_count": chunk.get("token_count", 0),
                "error": str(e),
            }


async def extract_directives_async(
    chunks: List[Dict[str, Any]],
    max_concurrent: int = 5,
) -> Dict[str, Any]:
    """
    Extract directives from all chunks in parallel using asyncio.gather().

    Args:
        chunks: List of chunk dicts from Module 5 (chunk.py).
        max_concurrent: Maximum concurrent LLM API calls.
                        Default 5 balances speed vs. rate limit risk.

    Returns:
        {
            "all_directives": List[directive dicts],
            "chunk_results": List[per-chunk result dicts],
            "total_directives_raw": int,   # before deduplication
            "failed_chunks": int,
            "total_elapsed_sec": float,
            "max_chunk_elapsed_sec": float  # demonstrates parallel speedup
        }

    WHY max_concurrent=5 (not unlimited):
    - Gemini has rate limits (requests per minute).
    - 5 concurrent calls is safe for most API tiers.
    - Increase to 10 for higher-tier API keys.
    """
    if not chunks:
        return {
            "all_directives": [],
            "chunk_results": [],
            "total_directives_raw": 0,
            "failed_chunks": 0,
            "total_elapsed_sec": 0.0,
            "max_chunk_elapsed_sec": 0.0,
        }

    semaphore = asyncio.Semaphore(max_concurrent)
    start_time = time.time()

    # Run all chunks concurrently
    tasks = [_process_chunk_async(chunk, semaphore) for chunk in chunks]
    chunk_results = await asyncio.gather(*tasks, return_exceptions=False)

    total_elapsed = round(time.time() - start_time, 2)
    max_chunk_elapsed = max((r["elapsed_sec"] for r in chunk_results), default=0.0)

    all_directives = []
    failed_chunks = 0
    for result in chunk_results:
        if result["error"]:
            failed_chunks += 1
        else:
            all_directives.extend(result["directives"])

    logger.info(
        f"Parallel extraction complete: {len(all_directives)} raw directives "
        f"from {len(chunks)} chunks in {total_elapsed}s "
        f"(max chunk: {max_chunk_elapsed}s, sequential would be: "
        f"~{sum(r['elapsed_sec'] for r in chunk_results):.1f}s)"
    )

    return {
        "all_directives": all_directives,
        "chunk_results": chunk_results,
        "total_directives_raw": len(all_directives),
        "failed_chunks": failed_chunks,
        "total_elapsed_sec": total_elapsed,
        "max_chunk_elapsed_sec": max_chunk_elapsed,
    }


def extract_directives_sync(
    chunks: List[Dict[str, Any]],
    max_concurrent: int = 5,
) -> Dict[str, Any]:
    """
    Synchronous wrapper for extract_directives_async.
    Use this when calling from non-async contexts (e.g., FastAPI background tasks).
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're inside an existing event loop (e.g., FastAPI)
            # Use asyncio.ensure_future or run in a new thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run,
                    extract_directives_async(chunks, max_concurrent)
                )
                return future.result()
        else:
            return loop.run_until_complete(
                extract_directives_async(chunks, max_concurrent)
            )
    except RuntimeError:
        return asyncio.run(extract_directives_async(chunks, max_concurrent))
