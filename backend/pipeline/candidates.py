"""
MODULE 3: HYBRID DIRECTIVE CANDIDATE SELECTOR
==============================================
This is the most critical module in the pipeline.

WHY pure regex fails:
- Explicit directives ("shall", "directed to") are easy to catch with regex.
- But Indian courts routinely phrase obligations as suggestions:
  "The State may consider taking appropriate steps..."
  "It would be needful for the department to..."
  "In the event of non-compliance, the officer shall..."
- Officers who miss these face contempt proceedings.
- RECALL > PRECISION: We'd rather flag 10 maybe-directives for human review
  than miss 1 real one.

THREE-LAYER HYBRID APPROACH:
- Layer A (Explicit): High-precision regex for unambiguous directives
- Layer B (Soft/Implied): High-recall regex for conditional/implied obligations
- Layer C (Positional): Last 20% of operative section — catches paragraph-form
  directives with no trigger words at all

Final set = UNION(A, B, C), deduplicated by paragraph identity.

JUSTIFICATION LOGGED:
"Layer A found X, Layer B found Y, Layer C added Z paragraphs not caught by regex"
"""

import re
import logging
from typing import List, Dict, Any, Set, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# LAYER A: Explicit directive patterns (high precision)
# These are unambiguous legal commands. Confidence: 0.85–0.95
# ---------------------------------------------------------------------------
LAYER_A_PATTERNS = [
    # Core mandatory language
    r'\bshall\b',
    r'\bis\s+hereby\s+directed\b',
    r'\bare\s+hereby\s+directed\b',
    r'\bis\s+hereby\s+ordered\b',
    r'\bare\s+hereby\s+ordered\b',
    r'\bordered\s+to\b',
    r'\bdirected\s+to\b',
    r'\bmandated\s+to\b',
    r'\brequired\s+to\b',
    r'\bmust\s+(?:forthwith|immediately|within|ensure|comply|submit|file|produce)\b',

    # Deadline language
    r'\bwithin\s+\d+\s+(?:days?|weeks?|months?|years?)\b',
    r'\bon\s+or\s+before\b',
    r'\bby\s+(?:the\s+)?(?:next|following)?\s*(?:date|hearing|Monday|Tuesday|Wednesday|Thursday|Friday)\b',
    r'\bforthwith\b',
    r'\bimmediately\b',
    r'\bwithout\s+(?:further\s+)?delay\b',
    r'\bwithout\s+fail\b',

    # Compliance language
    r'\bcomply\s+with\b',
    r'\bensure\s+compliance\b',
    r'\bstrictly\s+comply\b',
    r'\bfailure\s+to\s+comply\b',
    r'\bin\s+default\s+of\s+which\b',

    # Submission/filing language
    r'\bfile\s+(?:a\s+)?(?:reply|counter|affidavit|report|status\s+report)\b',
    r'\bsubmit\s+(?:a\s+)?(?:report|affidavit|reply|compliance\s+report)\b',
    r'\bplace\s+(?:on\s+)?record\b',
    r'\bproduce\s+(?:the\s+)?(?:record|documents?|files?)\b',

    # Contempt-adjacent language
    r'\bcontempt\s+of\s+court\b',
    r'\bpersonal\s+appearance\b',
    r'\bshow\s+cause\b',
    r'\bnotice\s+(?:is\s+)?(?:hereby\s+)?issued\b',
]

# ---------------------------------------------------------------------------
# LAYER B: Soft/Implied directive patterns (high recall)
# These catch conditional and implied responsibilities.
# Officers commonly miss these — they read like suggestions but carry legal weight.
# Confidence: 0.60–0.80
# ---------------------------------------------------------------------------
LAYER_B_PATTERNS = [
    # Soft obligation language
    r'\bmay\s+consider\b',
    r'\bwould\s+be\s+(?:appropriate|advisable|desirable|expedient)\b',
    r'\bappropriate\s+(?:steps?|action|measures?|orders?)\b',
    r'\bneedful\b',
    r'\bdo\s+the\s+needful\b',
    r'\bdeems?\s+(?:it\s+)?(?:fit|appropriate|necessary|proper)\b',
    r'\bas\s+may\s+be\s+(?:necessary|required|appropriate|expedient)\b',
    r'\bif\s+(?:and\s+when\s+)?(?:necessary|required|needed)\b',
    r'\bwherever\s+(?:necessary|required|applicable)\b',

    # Conditional obligation language
    r'\bif\s+.{5,80}?\s+(?:then|shall|must|should)\b',
    r'\bin\s+the\s+event\s+(?:of|that)\b',
    r'\bin\s+case\s+(?:of|where|the)\b',
    r'\bsubject\s+to\b',
    r'\bprovided\s+that\b',
    r'\bnotwithstanding\b',
    r'\bsave\s+and\s+except\b',

    # Expectation language
    r'\bis\s+expected\s+to\b',
    r'\bare\s+expected\s+to\b',
    r'\bshould\s+(?:ensure|take|consider|examine|look\s+into)\b',
    r'\bought\s+to\b',
    r'\bit\s+would\s+be\s+(?:open|proper|appropriate)\s+(?:for|to)\b',
    r'\bshall\s+be\s+open\s+to\b',
    r'\bliberty\s+(?:is\s+)?(?:hereby\s+)?(?:granted|given)\b',

    # Monitoring/review language (often implies ongoing obligation)
    r'\bmonitor\b',
    r'\bperiodically\s+review\b',
    r'\btake\s+(?:stock|note|cognizance)\b',
    r'\bkeep\s+(?:a\s+)?(?:watch|vigil|tab)\b',
    r'\bensure\s+that\b',
    r'\bsatisfy\s+(?:itself|themselves|the\s+court)\b',

    # Reporting/accountability language
    r'\breport\s+(?:back|to\s+(?:this\s+)?court|compliance)\b',
    r'\bplace\s+(?:a\s+)?(?:status\s+)?report\b',
    r'\baffidavit\s+(?:of\s+)?compliance\b',
    r'\baction\s+taken\s+report\b',
    r'\bATR\b',  # Action Taken Report — common in Indian administrative law

    # Remedial language
    r'\btake\s+remedial\s+(?:steps?|action|measures?)\b',
    r'\brectify\b',
    r'\baddress\s+the\s+(?:grievance|issue|concern|matter)\b',
    r'\bredress\b',
    r'\bameliorate\b',
]

# ---------------------------------------------------------------------------
# Operative section markers
# Indian judgments follow a predictable structure:
# Facts → Arguments → Law → OPERATIVE PART / ORDER
# The operative section contains the actual directives.
# ---------------------------------------------------------------------------
OPERATIVE_SECTION_MARKERS = [
    r'(?:IN\s+THE\s+RESULT|IN\s+THE\s+CIRCUMSTANCES)',
    r'(?:FOR\s+THE\s+(?:ABOVE|FOREGOING)\s+REASONS)',
    r'(?:ACCORDINGLY|IN\s+VIEW\s+OF\s+THE\s+ABOVE)',
    r'(?:WE\s+(?:HEREBY\s+)?(?:DIRECT|ORDER|HOLD|DECLARE))',
    r'(?:THE\s+(?:WRIT\s+PETITION|APPEAL|APPLICATION)\s+IS\s+(?:ALLOWED|DISMISSED|DISPOSED))',
    r'(?:IT\s+IS\s+(?:HEREBY\s+)?(?:ORDERED|DIRECTED|DECLARED))',
    r'(?:THE\s+FOLLOWING\s+DIRECTIONS?\s+(?:ARE\s+)?(?:ISSUED|GIVEN))',
    r'(?:OPERATIVE\s+PART)',
    r'(?:ORDER\s*:)',
    r'(?:DIRECTIONS?\s*:)',
]


@dataclass
class CandidateParagraph:
    """A paragraph identified as a potential directive."""
    text: str
    page_num: int
    paragraph_id: str          # e.g., "p12" or "p12_s3" (paragraph 12, sentence 3)
    layer: str                 # "A", "B", "C", or "A+B" (multiple layers matched)
    matched_patterns: List[str] = field(default_factory=list)
    is_operative: bool = False  # True if in the operative section


def _split_into_paragraphs(cleaned_pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Split cleaned page text into paragraphs, preserving page numbers.

    WHY paragraph-level (not sentence-level):
    - Directives often span multiple sentences: "The State shall... This must be done..."
    - Sentence-level splitting loses the connecting context.
    - Paragraph-level keeps the full obligation together.
    """
    paragraphs = []
    para_idx = 0

    for page in cleaned_pages:
        page_num = page["page_num"]
        text = page.get("text", "")

        # Split on double newlines (paragraph breaks) or numbered list items
        raw_paras = re.split(r'\n{2,}', text)

        for raw_para in raw_paras:
            stripped = raw_para.strip()
            if len(stripped) < 20:  # skip very short fragments
                continue

            para_idx += 1
            paragraphs.append({
                "text": stripped,
                "page_num": page_num,
                "para_idx": para_idx,
                "paragraph_id": f"p{para_idx}",
            })

    return paragraphs


def _find_operative_section_start(paragraphs: List[Dict[str, Any]]) -> int:
    """
    Find the index where the operative section begins.

    WHY this matters:
    - The last 20% of a judgment is almost always the operative part.
    - But some judgments have explicit markers ("IN THE RESULT", "ORDER:").
    - We use markers first, fall back to positional heuristic.
    """
    for i, para in enumerate(paragraphs):
        for marker in OPERATIVE_SECTION_MARKERS:
            if re.search(marker, para["text"], re.IGNORECASE):
                logger.info(f"Found operative section marker at paragraph {i+1}/{len(paragraphs)}")
                return i

    # Fallback: last 20% of paragraphs
    fallback_idx = int(len(paragraphs) * 0.80)
    logger.info(f"No operative marker found; using positional fallback at paragraph {fallback_idx+1}/{len(paragraphs)}")
    return fallback_idx


def _match_layer(text: str, patterns: List[str]) -> List[str]:
    """Return list of pattern strings that match the text."""
    matched = []
    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            matched.append(pattern)
    return matched


def select_candidates(cleaned_pages: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Run the 3-layer hybrid selector and return candidate paragraphs.

    Args:
        cleaned_pages: List of cleaned page dicts from Module 2 (clean.py).

    Returns:
        {
            "candidates": List[CandidateParagraph as dict],
            "total_paragraphs": int,
            "layer_a_count": int,
            "layer_b_count": int,
            "layer_c_count": int,   # paragraphs added ONLY by Layer C
            "justification": str
        }
    """
    paragraphs = _split_into_paragraphs(cleaned_pages)
    total_paragraphs = len(paragraphs)

    if total_paragraphs == 0:
        logger.warning("No paragraphs found in cleaned pages")
        return {
            "candidates": [],
            "total_paragraphs": 0,
            "layer_a_count": 0,
            "layer_b_count": 0,
            "layer_c_count": 0,
            "justification": "No paragraphs to process",
        }

    operative_start_idx = _find_operative_section_start(paragraphs)

    # Track which paragraphs are selected by each layer
    layer_a_ids: Set[str] = set()
    layer_b_ids: Set[str] = set()
    layer_c_ids: Set[str] = set()

    candidate_map: Dict[str, CandidateParagraph] = {}

    # --- LAYER A: Explicit directives ---
    for para in paragraphs:
        matched = _match_layer(para["text"], LAYER_A_PATTERNS)
        if matched:
            pid = para["paragraph_id"]
            layer_a_ids.add(pid)
            if pid not in candidate_map:
                candidate_map[pid] = CandidateParagraph(
                    text=para["text"],
                    page_num=para["page_num"],
                    paragraph_id=pid,
                    layer="A",
                    matched_patterns=matched,
                    is_operative=(para["para_idx"] - 1 >= operative_start_idx),
                )
            else:
                candidate_map[pid].layer = "A+" + candidate_map[pid].layer
                candidate_map[pid].matched_patterns.extend(matched)

    # --- LAYER B: Soft/Implied directives ---
    for para in paragraphs:
        matched = _match_layer(para["text"], LAYER_B_PATTERNS)
        if matched:
            pid = para["paragraph_id"]
            layer_b_ids.add(pid)
            if pid not in candidate_map:
                candidate_map[pid] = CandidateParagraph(
                    text=para["text"],
                    page_num=para["page_num"],
                    paragraph_id=pid,
                    layer="B",
                    matched_patterns=matched,
                    is_operative=(para["para_idx"] - 1 >= operative_start_idx),
                )
            else:
                existing_layer = candidate_map[pid].layer
                if "B" not in existing_layer:
                    candidate_map[pid].layer = existing_layer + "+B"
                candidate_map[pid].matched_patterns.extend(matched)

    # --- LAYER C: Positional heuristic (operative section) ---
    # Always include the last 20% of the document (operative section),
    # even if no regex matched. Real judgments often use paragraph-form directives.
    for para in paragraphs:
        if para["para_idx"] - 1 >= operative_start_idx:
            pid = para["paragraph_id"]
            if pid not in candidate_map:
                # Only count as "Layer C exclusive" if not already caught
                layer_c_ids.add(pid)
                candidate_map[pid] = CandidateParagraph(
                    text=para["text"],
                    page_num=para["page_num"],
                    paragraph_id=pid,
                    layer="C",
                    matched_patterns=["positional:operative_section"],
                    is_operative=True,
                )

    # Compute Layer C exclusive count (paragraphs ONLY caught by positional heuristic)
    layer_c_exclusive = layer_c_ids - layer_a_ids - layer_b_ids

    candidates = list(candidate_map.values())

    justification = (
        f"Layer A found {len(layer_a_ids)}, "
        f"Layer B found {len(layer_b_ids)}, "
        f"Layer C added {len(layer_c_exclusive)} paragraphs not caught by regex "
        f"(total candidates: {len(candidates)} from {total_paragraphs} paragraphs)"
    )
    logger.info(justification)

    return {
        "candidates": [
            {
                "text": c.text,
                "page_num": c.page_num,
                "paragraph_id": c.paragraph_id,
                "layer": c.layer,
                "matched_patterns": c.matched_patterns[:5],  # cap for readability
                "is_operative": c.is_operative,
            }
            for c in candidates
        ],
        "total_paragraphs": total_paragraphs,
        "layer_a_count": len(layer_a_ids),
        "layer_b_count": len(layer_b_ids),
        "layer_c_count": len(layer_c_exclusive),
        "justification": justification,
    }
