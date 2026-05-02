"""
MODULE 7: POST-PROCESSING & DEDUPLICATION
==========================================
Merges directives from all chunks, deduplicates semantic near-duplicates,
resolves relative deadlines to absolute dates, and flags items for human review.

WHY deduplication is necessary:
- Chunks overlap by 200 tokens (Module 5 design).
- The same directive paragraph may appear in 2 adjacent chunks.
- The LLM will extract it twice with slightly different wording.
- Without deduplication, officers see duplicate tasks → confusion.

DEDUPLICATION STRATEGY:
- Use sentence-transformers to compute semantic embeddings.
- Cosine similarity > 0.85 → treat as duplicate, keep the higher-confidence one.
- WHY 0.85 threshold: Below 0.85, directives are substantively different
  (different authority, different deadline). Above 0.85, they're the same
  directive with minor wording variation.

WHY sentence-transformers (not exact string match):
- "The State shall submit a report within 30 days" and
  "A report shall be submitted by the State within 30 days" are the same directive.
- String matching would keep both; semantic similarity catches the duplicate.

DEADLINE RESOLUTION:
- "within 30 days" + judgment_date "2024-03-15" → "2024-04-14"
- "within 3 months" → judgment_date + 90 days
- "within 6 weeks" → judgment_date + 42 days
- Absolute dates in the text are parsed directly.

HUMAN REVIEW FLAGS:
- confidence < 0.7 → low confidence, needs verification
- responsible_authority contains "AMBIGUOUS" → authority unclear
- directive_type == "conditional" → trigger condition needs human interpretation
- These are surfaced in the split-view UI with a red "Review Required" badge.
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Threshold for semantic deduplication
SIMILARITY_THRESHOLD = 0.85

# Confidence threshold below which directives are flagged for human review
HUMAN_REVIEW_CONFIDENCE_THRESHOLD = 0.70


# ---------------------------------------------------------------------------
# Deadline resolution
# ---------------------------------------------------------------------------

def _parse_judgment_date(judgment_date_str: Optional[str]) -> Optional[datetime]:
    """
    Parse judgment date from various formats found in Indian court documents.
    Returns None if parsing fails (deadlines will remain relative).
    """
    if not judgment_date_str:
        return None

    formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d.%m.%Y",
        "%d %B %Y",
        "%d %b %Y",
        "%dth %B %Y",
        "%dst %B %Y",
        "%dnd %B %Y",
        "%drd %B %Y",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
    ]

    # Normalize ordinal suffixes: "15th" → "15"
    normalized = re.sub(r'(\d+)(?:st|nd|rd|th)', r'\1', judgment_date_str)

    for fmt in formats:
        try:
            return datetime.strptime(normalized.strip(), fmt)
        except ValueError:
            continue

    logger.warning(f"Could not parse judgment date: '{judgment_date_str}'")
    return None


def _resolve_relative_deadline(
    deadline_relative: Optional[str],
    judgment_date: Optional[datetime],
) -> Optional[str]:
    """
    Resolve a relative deadline string to an ISO 8601 absolute date.

    Examples:
        "within 30 days" + 2024-03-15 → "2024-04-14"
        "within 3 months" + 2024-03-15 → "2024-06-13"
        "within 6 weeks" + 2024-03-15 → "2024-04-26"
        "forthwith" + 2024-03-15 → "2024-03-15" (same day)
        None → None
    """
    if not deadline_relative or not judgment_date:
        return None

    text = deadline_relative.lower().strip()

    # "forthwith" or "immediately" → same day as judgment
    if re.search(r'\b(?:forthwith|immediately|at\s+once)\b', text):
        return judgment_date.strftime("%Y-%m-%d")

    # "within X days"
    days_match = re.search(r'within\s+(\d+)\s+days?', text)
    if days_match:
        days = int(days_match.group(1))
        return (judgment_date + timedelta(days=days)).strftime("%Y-%m-%d")

    # "within X weeks"
    weeks_match = re.search(r'within\s+(\d+)\s+weeks?', text)
    if weeks_match:
        weeks = int(weeks_match.group(1))
        return (judgment_date + timedelta(weeks=weeks)).strftime("%Y-%m-%d")

    # "within X months"
    months_match = re.search(r'within\s+(\d+)\s+months?', text)
    if months_match:
        months = int(months_match.group(1))
        return (judgment_date + timedelta(days=months * 30)).strftime("%Y-%m-%d")

    # "within X years"
    years_match = re.search(r'within\s+(\d+)\s+years?', text)
    if years_match:
        years = int(years_match.group(1))
        return (judgment_date + timedelta(days=years * 365)).strftime("%Y-%m-%d")

    # "on or before [date]" — try to parse the date directly
    date_match = re.search(
        r'(?:on\s+or\s+before|by|before)\s+(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})',
        text
    )
    if date_match:
        try:
            parsed = datetime.strptime(date_match.group(1), "%d/%m/%Y")
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # "next hearing" or "next date" → return None (can't resolve without calendar)
    if re.search(r'next\s+(?:hearing|date|listing)', text):
        return None

    return None


# ---------------------------------------------------------------------------
# Semantic deduplication
# ---------------------------------------------------------------------------

def _compute_embeddings(texts: List[str]):
    """
    Compute sentence embeddings for deduplication.

    WHY lazy import:
    - sentence-transformers is a large dependency (~500MB).
    - If not installed, we fall back to exact string matching.
    - This keeps the pipeline functional in minimal environments.
    """
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")  # fast, 80MB, good quality
        return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    except ImportError:
        logger.warning(
            "sentence-transformers not installed; "
            "falling back to exact string deduplication"
        )
        return None


def _cosine_similarity(a, b) -> float:
    """Compute cosine similarity between two numpy vectors."""
    import numpy as np
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _deduplicate_directives(
    directives: List[Dict[str, Any]],
    similarity_threshold: float = SIMILARITY_THRESHOLD,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Remove semantic near-duplicates from the directive list.

    Strategy:
    1. Compute embeddings for all directive_text values.
    2. For each pair with similarity > threshold, keep the higher-confidence one.
    3. Return deduplicated list + count of removed duplicates.

    Falls back to exact string matching if sentence-transformers unavailable.
    """
    if len(directives) <= 1:
        return directives, 0

    texts = [d.get("directive_text", "") for d in directives]

    embeddings = _compute_embeddings(texts)

    if embeddings is None:
        # Fallback: exact string deduplication (normalized)
        seen_texts = set()
        unique = []
        for d in directives:
            normalized = re.sub(r'\s+', ' ', d.get("directive_text", "")).strip().lower()
            if normalized not in seen_texts:
                seen_texts.add(normalized)
                unique.append(d)
        removed = len(directives) - len(unique)
        logger.info(f"Exact deduplication: removed {removed} duplicates")
        return unique, removed

    # Semantic deduplication using cosine similarity
    import numpy as np
    n = len(directives)
    to_remove: set = set()

    for i in range(n):
        if i in to_remove:
            continue
        for j in range(i + 1, n):
            if j in to_remove:
                continue
            sim = _cosine_similarity(embeddings[i], embeddings[j])
            if sim >= similarity_threshold:
                # Keep the one with higher confidence
                conf_i = directives[i].get("confidence", 0.0)
                conf_j = directives[j].get("confidence", 0.0)
                to_remove.add(j if conf_i >= conf_j else i)

    unique = [d for i, d in enumerate(directives) if i not in to_remove]
    removed = len(to_remove)
    logger.info(
        f"Semantic deduplication (threshold={similarity_threshold}): "
        f"removed {removed} duplicates from {n} raw directives → {len(unique)} unique"
    )
    return unique, removed


# ---------------------------------------------------------------------------
# Human review flagging
# ---------------------------------------------------------------------------

def _flag_for_review(directive: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add review flags to a directive based on confidence and ambiguity signals.

    WHY mandatory human review for AMBIGUOUS:
    - An officer acting on a directive with the wrong responsible authority
      could cause harm or miss the actual obligation.
    - Better to flag and review than to act on a hallucinated authority.
    """
    flags = []

    confidence = directive.get("confidence", 1.0)
    if confidence < HUMAN_REVIEW_CONFIDENCE_THRESHOLD:
        flags.append(f"low_confidence:{confidence:.2f}")

    authority = directive.get("responsible_authority", "")
    if "AMBIGUOUS" in authority.upper():
        flags.append("ambiguous_authority")

    directive_type = directive.get("directive_type", "").lower()
    if directive_type == "conditional":
        flags.append("conditional_trigger_needs_review")

    if directive.get("deadline_relative") and not directive.get("deadline_absolute"):
        flags.append("deadline_unresolved")

    directive["requires_human_review"] = len(flags) > 0
    directive["review_flags"] = flags

    return directive


# ---------------------------------------------------------------------------
# Main post-processing function
# ---------------------------------------------------------------------------

def postprocess_directives(
    raw_directives: List[Dict[str, Any]],
    judgment_date_str: Optional[str],
    appeal_window_days: int = 90,
) -> Dict[str, Any]:
    """
    Post-process raw LLM-extracted directives: deduplicate, resolve deadlines,
    flag for review, and compute the appeal window.

    Args:
        raw_directives: All directives from all chunks (may contain duplicates).
        judgment_date_str: Judgment date string from metadata (Module 2).
        appeal_window_days: Days for appeal window (default 90 per Indian law).

    Returns:
        {
            "directives": List[processed directive dicts],
            "total_raw": int,
            "total_after_dedup": int,
            "duplicates_removed": int,
            "ambiguous_flagged": int,
            "low_confidence_flagged": int,
            "appeal_window_end": str | None,
            "judgment_date_parsed": str | None,
        }
    """
    total_raw = len(raw_directives)
    logger.info(f"Post-processing {total_raw} raw directives")

    # Step 1: Deduplicate
    unique_directives, duplicates_removed = _deduplicate_directives(raw_directives)

    # Step 2: Parse judgment date for deadline resolution
    judgment_date = _parse_judgment_date(judgment_date_str)
    judgment_date_parsed = judgment_date.strftime("%Y-%m-%d") if judgment_date else None

    # Step 3: Compute appeal window
    appeal_window_end = None
    if judgment_date:
        appeal_window_end = (
            judgment_date + timedelta(days=appeal_window_days)
        ).strftime("%Y-%m-%d")

    # Step 4: Resolve relative deadlines + flag for review
    processed = []
    ambiguous_count = 0
    low_confidence_count = 0

    for directive in unique_directives:
        # Resolve deadline
        deadline_relative = directive.get("deadline_relative")
        if deadline_relative and not directive.get("deadline_absolute"):
            resolved = _resolve_relative_deadline(deadline_relative, judgment_date)
            if resolved:
                directive["deadline_absolute"] = resolved

        # Flag for review
        directive = _flag_for_review(directive)

        if directive.get("requires_human_review"):
            flags = directive.get("review_flags", [])
            if any("ambiguous" in f for f in flags):
                ambiguous_count += 1
            if any("low_confidence" in f for f in flags):
                low_confidence_count += 1

        processed.append(directive)

    logger.info(
        f"Post-processing complete: {total_raw} raw → {len(processed)} unique directives. "
        f"Duplicates removed: {duplicates_removed}. "
        f"Flagged for review: {ambiguous_count} ambiguous, {low_confidence_count} low-confidence."
    )

    return {
        "directives": processed,
        "total_raw": total_raw,
        "total_after_dedup": len(processed),
        "duplicates_removed": duplicates_removed,
        "ambiguous_flagged": ambiguous_count,
        "low_confidence_flagged": low_confidence_count,
        "appeal_window_end": appeal_window_end,
        "judgment_date_parsed": judgment_date_parsed,
    }
