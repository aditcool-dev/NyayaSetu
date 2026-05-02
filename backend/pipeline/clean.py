"""
MODULE 2: CONTEXT-PRESERVING CLEANER
=====================================
Removes noise (headers, footers, watermarks, page numbers) while preserving
everything that gives directives their legal meaning.

WHAT WE REMOVE:
- Page numbers (standalone digits or "Page X of Y")
- Repeated headers/footers (detected by frequency across pages)
- Watermarks: "CERTIFIED TRUE COPY", "WWW.LIVELAW.IN", "NOT FOR PUBLICATION"
- Excessive whitespace (3+ blank lines → 1)

WHAT WE KEEP (critical for directive context):
- Paragraph numbering: "1.", "2.", "(i)", "(ii)", "(a)" — needed for source_paragraph
- Case headers: court name, case number, date
- Party names and judge names
- Legal Latin: "inter alia", "suo motu", "locus standi" — provide directive context
- Case citations: "AIR 2019 SC 1234" — establish legal precedent context

WHY we extract metadata here (not in Module 1):
- Metadata (case_no, court, parties) is injected into EVERY LLM chunk (Module 5).
- Extracting it once here avoids re-parsing in every downstream module.
- The case_header anchors LLM extraction and prevents hallucinated authorities.
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Watermark / boilerplate patterns to strip
# These appear verbatim in Indian court PDFs from various sources
# ---------------------------------------------------------------------------
WATERMARK_PATTERNS = [
    r'CERTIFIED\s+TRUE\s+COPY',
    r'WWW\.LIVELAW\.IN',
    r'WWW\.BARANDBENCH\.COM',
    r'NOT\s+FOR\s+PUBLICATION',
    r'REPORTABLE',
    r'NON[-\s]?REPORTABLE',
    r'IN\s+THE\s+SUPREME\s+COURT\s+OF\s+INDIA\s*\n\s*CIVIL\s+APPELLATE\s+JURISDICTION',  # repeated header
    r'Digitally\s+signed\s+by\s+\w+',
    r'Signature\s+Not\s+Verified',
    r'HIGH\s+COURT\s+OF\s+\w+\s*\n\s*AT\s+\w+',  # repeated court header
]

# Page number patterns (standalone, not embedded in text)
PAGE_NUMBER_PATTERNS = [
    r'^\s*-?\s*\d+\s*-?\s*$',          # "- 5 -" or "5"
    r'^\s*Page\s+\d+\s+of\s+\d+\s*$',  # "Page 5 of 50"
    r'^\s*\d+\s*/\s*\d+\s*$',          # "5/50"
]

# Metadata extraction patterns for Indian court judgments
CASE_NUMBER_PATTERNS = [
    r'(?:W\.?P\.?\s*(?:Civil|Crl|PIL)?\.?\s*(?:No\.?)?\s*\d+[\s/]\d{4})',
    r'(?:Writ\s+Petition\s+(?:Civil|Criminal)?\s*No\.?\s*\d+[\s/]\d{4})',
    r'(?:Civil\s+Appeal\s+No\.?\s*\d+[\s/]\d{4})',
    r'(?:Criminal\s+Appeal\s+No\.?\s*\d+[\s/]\d{4})',
    r'(?:SLP\s*(?:Civil|Crl)?\.?\s*No\.?\s*\d+[\s/]\d{4})',
    r'(?:O\.?S\.?\s*No\.?\s*\d+[\s/]\d{4})',
    r'(?:R\.?S\.?A\.?\s*No\.?\s*\d+[\s/]\d{4})',
    r'(?:Contempt\s+(?:Petition|Case)\s*(?:Civil|Crl)?\.?\s*No\.?\s*\d+[\s/]\d{4})',
]

COURT_PATTERNS = [
    r'IN\s+THE\s+(HIGH\s+COURT\s+OF\s+[\w\s]+)',
    r'IN\s+THE\s+(SUPREME\s+COURT\s+OF\s+INDIA)',
    r'IN\s+THE\s+(DISTRICT\s+COURT\s+(?:AT|OF)\s+[\w\s]+)',
    r'(HIGH\s+COURT\s+OF\s+[\w\s]+)\s+AT\s+\w+',
    r'BEFORE\s+THE\s+([\w\s]+\s+COURT)',
]

DATE_PATTERNS = [
    r'(?:Dated?|Date\s+of\s+(?:Order|Judgment|Decision))[:\s]+(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})',
    r'(?:Dated?|Date\s+of\s+(?:Order|Judgment|Decision))[:\s]+(\d{1,2}\s+\w+\s+\d{4})',
    r'(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})',
    r'(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})',
]

JUDGE_PATTERNS = [
    r'(?:CORAM|BEFORE|BENCH)[:\s]+(?:HON\'?BLE\s+)?(?:MR\.?\s+|MS\.?\s+|MRS\.?\s+)?(?:JUSTICE\s+)([\w\s,\.]+?)(?:\n|AND\s+HON)',
    r'HON\'?BLE\s+(?:MR\.?\s+|MS\.?\s+)?(?:JUSTICE\s+)([\w\s\.]+)',
    r'J\.\s+([\w\s\.]+),\s+J\.',
]

PARTIES_PATTERN = re.compile(
    r'([\w\s\.\(\)&,]+?)\s*\n\s*(?:\.{3,}|Vs?\.?|VERSUS|v/s)\s*\n\s*([\w\s\.\(\)&,]+?)\s*\n',
    re.IGNORECASE
)


def _detect_repeated_lines(pages: List[Dict[str, Any]], min_frequency: int = 3) -> set:
    """
    Detect lines that appear on 3+ pages — these are headers/footers.

    WHY frequency-based detection (not hardcoded patterns):
    - Every court has different header formats.
    - Hardcoded patterns miss court-specific boilerplate.
    - Lines appearing on 3+ pages are almost certainly structural noise.
    """
    line_counter: Counter = Counter()
    for page in pages:
        lines = page.get("text", "").split('\n')
        # Only check short lines (headers/footers are rarely > 80 chars)
        for line in lines:
            stripped = line.strip()
            if 5 < len(stripped) < 80:
                line_counter[stripped] += 1

    return {line for line, count in line_counter.items() if count >= min_frequency}


def _clean_page_text(text: str, repeated_lines: set) -> str:
    """
    Clean a single page's text: remove noise, preserve legal structure.
    """
    lines = text.split('\n')
    cleaned_lines = []

    for line in lines:
        stripped = line.strip()

        # Skip repeated headers/footers
        if stripped in repeated_lines:
            continue

        # Skip standalone page numbers
        if any(re.match(p, stripped, re.IGNORECASE) for p in PAGE_NUMBER_PATTERNS):
            continue

        # Skip watermarks
        if any(re.search(p, stripped, re.IGNORECASE) for p in WATERMARK_PATTERNS):
            continue

        cleaned_lines.append(line)

    # Collapse 3+ consecutive blank lines to 1 (preserve paragraph breaks)
    result = '\n'.join(cleaned_lines)
    result = re.sub(r'\n{3,}', '\n\n', result)

    return result.strip()


def _extract_metadata(full_text: str) -> Dict[str, Optional[str]]:
    """
    Extract case metadata from the full document text.

    WHY we extract metadata here:
    - case_header is injected into every LLM chunk to anchor extraction.
    - Without it, the LLM hallucinates "responsible_authority" from thin air.
    - Extracting once here is O(1) vs. re-extracting in every chunk.
    """
    metadata: Dict[str, Optional[str]] = {
        "case_no": None,
        "court": None,
        "judgment_date": None,
        "parties_petitioner": None,
        "parties_respondent": None,
        "judge": None,
    }

    # Case number
    for pattern in CASE_NUMBER_PATTERNS:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            metadata["case_no"] = match.group(0).strip()
            break

    # Court name
    for pattern in COURT_PATTERNS:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            metadata["court"] = match.group(1).strip()
            break

    # Judgment date (take the first date found in the document header area)
    header_text = full_text[:3000]  # dates usually appear in first ~3000 chars
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, header_text, re.IGNORECASE)
        if match:
            metadata["judgment_date"] = match.group(1).strip()
            break

    # Judge names
    for pattern in JUDGE_PATTERNS:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            metadata["judge"] = match.group(1).strip()
            break

    # Parties (petitioner vs. respondent)
    parties_match = PARTIES_PATTERN.search(full_text[:5000])
    if parties_match:
        metadata["parties_petitioner"] = parties_match.group(1).strip()
        metadata["parties_respondent"] = parties_match.group(2).strip()

    return metadata


def clean_pages(pages: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Clean all pages and extract document metadata.

    Args:
        pages: List of page dicts from Module 1 (extract.py).
               Each dict: {page_num, text, ocr_used, quality_score, ...}

    Returns:
        {
            "cleaned_pages": List[{page_num, text, original_char_count, cleaned_char_count}],
            "full_cleaned_text": str,   # concatenated, page-delimited
            "metadata": {case_no, court, judgment_date, parties_petitioner,
                         parties_respondent, judge},
            "chars_removed": int,
            "noise_lines_detected": int
        }
    """
    # Step 1: Detect repeated lines across all pages (headers/footers)
    repeated_lines = _detect_repeated_lines(pages)
    logger.info(f"Detected {len(repeated_lines)} repeated header/footer lines to strip")

    cleaned_pages = []
    total_original_chars = 0
    total_cleaned_chars = 0

    for page in pages:
        original_text = page.get("text", "")
        cleaned_text = _clean_page_text(original_text, repeated_lines)

        total_original_chars += len(original_text)
        total_cleaned_chars += len(cleaned_text)

        cleaned_pages.append({
            "page_num": page["page_num"],
            "text": cleaned_text,
            "original_char_count": len(original_text),
            "cleaned_char_count": len(cleaned_text),
            "ocr_used": page.get("ocr_used", False),
            "quality_score": page.get("quality_score", 1.0),
        })

    # Step 2: Build full text with page markers (needed for source citations)
    full_cleaned_text = "\n\n".join(
        f"[PAGE {p['page_num']}]\n{p['text']}"
        for p in cleaned_pages
        if p["text"].strip()
    )

    # Step 3: Extract metadata from full cleaned text
    metadata = _extract_metadata(full_cleaned_text)

    chars_removed = total_original_chars - total_cleaned_chars
    logger.info(
        f"Cleaning complete: removed {chars_removed} chars "
        f"({100 * chars_removed / max(total_original_chars, 1):.1f}% noise reduction)"
    )

    return {
        "cleaned_pages": cleaned_pages,
        "full_cleaned_text": full_cleaned_text,
        "metadata": metadata,
        "chars_removed": chars_removed,
        "noise_lines_detected": len(repeated_lines),
    }
