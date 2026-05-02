"""
MODULE 4: CONTEXT-WINDOW BUILDER
==================================
For each candidate directive sentence, build a context packet that includes
the surrounding paragraphs and the case header.

WHY context anchoring prevents hallucination:
- Sending "submit report within 30 days" alone to an LLM causes it to
  hallucinate WHO must submit and WHAT report.
- The preceding paragraph usually establishes the subject ("The State of
  Karnataka, through its Principal Secretary...").
- The following paragraph often clarifies the consequence of non-compliance.
- The case_header anchors the responsible authority to the actual parties.

WHAT each context packet contains:
- candidate_sentence: The paragraph that triggered a Layer A/B/C match
- preceding_paragraph: 1 paragraph before (establishes subject/context)
- following_paragraph: 1 paragraph after (establishes consequence/scope)
- case_header: {case_no, court, judgment_date, parties} — injected into every LLM call
- paragraph_number: The structural number if present (e.g., "12(iii)")
- page_number: For source citation in the split-view UI

This module does NOT call the LLM — it only prepares the input.
"""

import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


# Regex to detect paragraph numbering in Indian court judgments
# Matches: "1.", "12.", "(i)", "(ii)", "(a)", "1(a)", "Para 12", "¶12"
PARA_NUMBER_PATTERN = re.compile(
    r'^(?:'
    r'(?:Para(?:graph)?\s*\.?\s*\d+)'   # "Para 12" or "Paragraph 12"
    r'|(?:¶\s*\d+)'                      # "¶12"
    r'|(?:\d+\.\s)'                      # "12. "
    r'|(?:\(\s*[ivxlcdmIVXLCDM]+\s*\))' # "(i)", "(iv)", "(xii)"
    r'|(?:\(\s*[a-zA-Z]\s*\))'          # "(a)", "(b)"
    r'|(?:\d+\s*\(\s*[a-zA-Z]\s*\))'   # "1(a)", "2(b)"
    r')',
    re.IGNORECASE
)


def _extract_paragraph_number(text: str) -> Optional[str]:
    """
    Extract the paragraph number from the start of a paragraph text.

    WHY we extract this:
    - source_paragraph in the LLM output must reference the actual paragraph
      number from the judgment (e.g., "12(iii)") for legal traceability.
    - Officers and lawyers use these numbers to locate directives in the original.
    """
    match = PARA_NUMBER_PATTERN.match(text.strip())
    if match:
        return match.group(0).strip()
    return None


def _find_paragraph_index(
    all_paragraphs: List[Dict[str, Any]],
    candidate_paragraph_id: str
) -> int:
    """Find the index of a candidate in the full paragraph list."""
    for i, para in enumerate(all_paragraphs):
        if para.get("paragraph_id") == candidate_paragraph_id:
            return i
    return -1


def build_context_packets(
    candidates: List[Dict[str, Any]],
    all_paragraphs: List[Dict[str, Any]],
    metadata: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Build context packets for each candidate directive paragraph.

    Args:
        candidates: List of candidate dicts from Module 3 (candidates.py).
        all_paragraphs: Full list of paragraphs (needed to find neighbors).
                        Each dict: {text, page_num, paragraph_id, para_idx}
        metadata: Case metadata from Module 2 (clean.py).
                  {case_no, court, judgment_date, parties_petitioner,
                   parties_respondent, judge}

    Returns:
        List of context packet dicts, one per candidate:
        {
            "candidate_sentence": str,
            "preceding_paragraph": str | None,
            "following_paragraph": str | None,
            "case_header": {case_no, court, judgment_date, parties},
            "paragraph_number": str | None,
            "page_number": int,
            "paragraph_id": str,
            "layer": str,
            "matched_patterns": List[str]
        }

    WHY we include matched_patterns in the packet:
    - The LLM prompt can use this as a hint: "This paragraph was flagged
      because it contains 'may consider' — check for implied obligations."
    - Helps the LLM assign appropriate confidence scores.
    """
    # Build a lookup map for fast neighbor access
    para_by_id: Dict[str, int] = {
        p.get("paragraph_id", ""): i
        for i, p in enumerate(all_paragraphs)
    }

    # Build the case_header once — injected into every packet
    case_header = {
        "case_no": metadata.get("case_no") or "Unknown",
        "court": metadata.get("court") or "Unknown",
        "judgment_date": metadata.get("judgment_date") or "Unknown",
        "parties": {
            "petitioner": metadata.get("parties_petitioner") or "Unknown",
            "respondent": metadata.get("parties_respondent") or "Unknown",
        },
        "judge": metadata.get("judge") or "Unknown",
    }

    context_packets = []

    for candidate in candidates:
        pid = candidate.get("paragraph_id", "")
        candidate_text = candidate.get("text", "")
        page_num = candidate.get("page_num", 0)

        # Find position in full paragraph list
        idx = para_by_id.get(pid, -1)

        # Get preceding paragraph (1 before)
        preceding = None
        if idx > 0:
            preceding = all_paragraphs[idx - 1].get("text", "")

        # Get following paragraph (1 after)
        following = None
        if idx >= 0 and idx < len(all_paragraphs) - 1:
            following = all_paragraphs[idx + 1].get("text", "")

        # Extract paragraph number from the candidate text itself
        para_number = _extract_paragraph_number(candidate_text)

        packet = {
            "candidate_sentence": candidate_text,
            "preceding_paragraph": preceding,
            "following_paragraph": following,
            "case_header": case_header,
            "paragraph_number": para_number,
            "page_number": page_num,
            "paragraph_id": pid,
            "layer": candidate.get("layer", ""),
            "matched_patterns": candidate.get("matched_patterns", []),
            "is_operative": candidate.get("is_operative", False),
        }

        context_packets.append(packet)

    logger.info(f"Built {len(context_packets)} context packets with case_header anchoring")
    return context_packets
