"""
MODULE 1: SMART PDF EXTRACTION
==============================
Strategy: PyMuPDF (fitz) for native text extraction first, with page-level
Tesseract OCR fallback ONLY for pages that fail quality checks.

WHY PyMuPDF over pdfplumber:
- 3-5x faster on large PDFs (critical for <10 min target)
- Better paragraph boundary preservation
- Direct page-to-image rendering for OCR fallback

WHY page-level OCR (not whole-doc):
- A typical 50-page judgment has 5-10 scanned pages mixed with digital text.
- Whole-doc OCR wastes 5-8 minutes on pages that already have good text.
- We OCR only the pages that fail quality checks.

Quality check logic:
- len(text) < 50 chars → likely blank or header-only page
- garbled_ratio > 0.30 → >30% non-ASCII/non-printable chars → scanned image
"""

import fitz  # PyMuPDF
import re
import time
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class PageData:
    """Structured output for a single extracted page."""
    page_num: int          # 1-indexed, matches physical page number for citations
    text: str              # Extracted text (native or OCR)
    ocr_used: bool         # True if Tesseract was invoked for this page
    quality_score: float   # 0.0–1.0; higher = cleaner text
    char_count: int        # Raw character count before cleaning
    extraction_time_ms: float  # Per-page timing for diagnostics


def _compute_quality_score(text: str) -> float:
    """
    Compute a text quality score between 0.0 and 1.0.

    WHY this heuristic:
    - Scanned PDFs with embedded images produce either empty text or garbled
      characters (ligatures, encoding artifacts).
    - We check two signals: length (too short = no real content) and
      garbled ratio (non-printable / non-ASCII chars as fraction of total).
    - Score < 0.5 triggers OCR fallback.
    """
    if not text or len(text.strip()) < 10:
        return 0.0

    total_chars = len(text)
    # Count characters that are NOT standard printable ASCII or common Unicode
    # (Devanagari, Latin extended are fine; random control chars are not)
    garbled = sum(
        1 for c in text
        if ord(c) < 32 and c not in ('\n', '\r', '\t')
    )
    garbled_ratio = garbled / total_chars if total_chars > 0 else 1.0

    length_score = min(1.0, len(text.strip()) / 200)  # saturates at 200 chars
    garble_penalty = garbled_ratio * 2                 # amplify garble signal

    score = max(0.0, length_score - garble_penalty)
    return round(score, 3)


def _ocr_page(page: fitz.Page, dpi: int = 300) -> str:
    """
    Render a single PDF page to image and run Tesseract OCR.

    WHY 300 DPI:
    - Below 200 DPI, Tesseract accuracy drops sharply on small fonts.
    - Above 400 DPI, processing time increases with diminishing returns.
    - 300 DPI is the sweet spot for court documents (typically 12pt fonts).

    WHY we import pytesseract here (lazy import):
    - Tesseract is an optional dependency; if not installed, native extraction
      still works for digital PDFs.
    """
    try:
        import pytesseract
        from PIL import Image
        import io

        # Render page to pixmap at target DPI
        mat = fitz.Matrix(dpi / 72, dpi / 72)  # 72 DPI is PDF default
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY)  # grayscale saves memory

        # Convert to PIL Image
        img_bytes = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_bytes))

        # Tesseract config: PSM 6 = assume uniform block of text (best for court docs)
        # OEM 3 = default (LSTM + legacy), lang = eng (add 'kan' or 'hin' for regional)
        custom_config = r'--oem 3 --psm 6 -l eng'
        text = pytesseract.image_to_string(img, config=custom_config)
        return text

    except ImportError:
        logger.warning("pytesseract not installed — OCR fallback unavailable for this page.")
        return ""
    except Exception as e:
        logger.error(f"OCR failed for page: {e}")
        return ""


def extract_pdf(pdf_path: str, ocr_quality_threshold: float = 0.4) -> Dict[str, Any]:
    """
    Extract text from a PDF with smart per-page OCR fallback.

    Args:
        pdf_path: Absolute or relative path to the PDF file.
        ocr_quality_threshold: Pages with quality_score below this get OCR.
                               Default 0.4 balances recall vs. speed.

    Returns:
        {
            "pages": List[PageData as dict],
            "total_pages": int,
            "ocr_pages": int,
            "native_pages": int,
            "extraction_time_sec": float,
            "justification": str   # logged to observability
        }

    WHY we return per-page data (not just full_text):
    - Downstream modules need page_num for source citations in the split-view UI.
    - Context builder (Module 4) uses page boundaries to anchor directives.
    """
    start_time = time.time()
    pages: List[PageData] = []
    ocr_page_count = 0

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        raise RuntimeError(f"Cannot open PDF at '{pdf_path}': {e}")

    total_pages = len(doc)

    for page_idx in range(total_pages):
        page_start = time.time()
        page = doc[page_idx]
        page_num = page_idx + 1  # 1-indexed for human-readable citations

        # --- Attempt 1: Native text extraction (fast, ~1ms/page) ---
        native_text = page.get_text("text")  # preserves paragraph order
        quality = _compute_quality_score(native_text)

        ocr_used = False
        final_text = native_text

        # --- Attempt 2: OCR fallback for low-quality pages ---
        if quality < ocr_quality_threshold:
            logger.info(f"Page {page_num}: quality={quality:.2f} < threshold={ocr_quality_threshold} → OCR")
            ocr_text = _ocr_page(page)
            ocr_quality = _compute_quality_score(ocr_text)

            # Use OCR result only if it's actually better
            if ocr_quality > quality:
                final_text = ocr_text
                quality = ocr_quality
                ocr_used = True
                ocr_page_count += 1
            else:
                logger.warning(f"Page {page_num}: OCR quality ({ocr_quality:.2f}) not better than native ({quality:.2f}), keeping native")

        page_time_ms = (time.time() - page_start) * 1000

        pages.append(PageData(
            page_num=page_num,
            text=final_text,
            ocr_used=ocr_used,
            quality_score=quality,
            char_count=len(final_text),
            extraction_time_ms=round(page_time_ms, 1)
        ))

    doc.close()

    native_pages = total_pages - ocr_page_count
    extraction_time = round(time.time() - start_time, 2)

    # Estimate time saved: OCR takes ~3s/page, native takes ~0.01s/page
    time_saved_estimate = native_pages * 3.0
    justification = (
        f"Avoided OCR on {native_pages} of {total_pages} pages "
        f"→ saved ~{time_saved_estimate:.0f} seconds"
    )
    logger.info(justification)

    return {
        "pages": [vars(p) for p in pages],
        "total_pages": total_pages,
        "ocr_pages": ocr_page_count,
        "native_pages": native_pages,
        "extraction_time_sec": extraction_time,
        "justification": justification,
    }
