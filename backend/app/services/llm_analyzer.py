import os
import time
import json
from typing import Dict, Any

from google import genai
from google.genai import types

SYSTEM_PROMPT = """
You are an expert Indian legal analyst. Your task is to analyze a court judgment and extract key information into a structured JSON format.
First, classify the judgment into one of three types: "Directive", "Policy/Interpretation", or "Appeal/Argument".
Provide a classification_confidence score between 0.8 and 0.95.
If the judgment type is "Directive", extract the actionable directives.
If the judgment type is "Policy/Interpretation" or "Appeal/Argument", DO NOT extract fake directives. The "directives" list MUST be empty. Do not hallucinate deadlines or tasks.
For ALL judgments, extract the "key_legal_takeaway" and the "impact_on_departments" (Insights Mode).
For each Directive, classify its type as "Mandatory", "Advisory", or "Conditional".
Assign a Priority of "High" (strict legal deadline), "Medium" (administrative), or "Low" (informational).
Rewrite "text" into a clean, actionable, readable third-person instruction. Do not just copy raw text.
Group related directives into a logical process flow by giving them the same "workflow_category".
If the directive is Conditional, provide the "trigger_condition". Otherwise, null.
CRITICAL RULE ON DEADLINES: If there is no explicit timeframe mentioned, DO NOT hallucinate a deadline. Set deadline_raw and deadline_resolved to null.
Always quote the source text verbatim for directives in "source_text".
Vary confidence scores: 0.95 for explicit Mandatory, 0.90 for Conditional, 0.85 for vague Advisory.
The JSON output must adhere strictly to the requested schema.
"""

PROMPT_TEMPLATE = """
Analyze the following legal document and extract information matching this JSON structure:
{{
  "case_number": "string",
  "court": "string",
  "judgment_type": "Directive | Policy/Interpretation | Appeal/Argument",
  "classification_confidence": number (0.8 to 0.95),
  "judgment_date": "ISO 8601 date string",
  "parties": {{ "petitioner": "string", "respondent": "string" }},
  "summary": "string",
  "key_legal_takeaway": "string or null",
  "impact_on_departments": "string or null",
  "directives": [
    {{
      "text": "string actionable summary",
      "directive_type": "Mandatory | Advisory | Conditional",
      "priority": "High | Medium | Low",
      "workflow_category": "string",
      "trigger_condition": "string or null",
      "responsible_department": "string",
      "deadline_raw": "string or null",
      "deadline_resolved": "ISO 8601 date string or null",
      "confidence_score": number (0.8 to 0.95),
      "source_text": "string verbatim quote",
      "source_page": number
    }}
  ]
}}

<legal_document>
{text}
</legal_document>
"""


def analyze_judgment(text: str) -> Dict[Any, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip(' "\'')
    if not api_key:
        print("Error: GEMINI_API_KEY not found")
        return {}

    client = genai.Client(api_key=api_key)

    prompt = PROMPT_TEMPLATE.format(text=text)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.1,
                    top_p=0.95,
                    max_output_tokens=8192,
                    response_mime_type="application/json",
                ),
            )
            text_response = response.text.strip()
            # Strip markdown code fences if present
            if text_response.startswith("```json"):
                text_response = text_response[7:]
            if text_response.startswith("```"):
                text_response = text_response[3:]
            if text_response.endswith("```"):
                text_response = text_response[:-3]
            return json.loads(text_response.strip())

        except Exception as e:
            error_str = str(e)
            if "429" in error_str and attempt < max_retries - 1:
                wait_time = 5 * (attempt + 1)
                print(f"Rate limited (429). Waiting {wait_time}s before retry {attempt + 2}/{max_retries}...")
                time.sleep(wait_time)
            else:
                print(f"Error calling Gemini API: {e}")
                return {}

    return {}
