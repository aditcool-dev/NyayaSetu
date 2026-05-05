"""
Tests for Module 1: Smart PDF Extraction (pipeline/extract.py)

Tests cover:
- Quality score computation
- Native text extraction path
- OCR fallback triggering logic
- Per-page data structure
- Justification logging
"""

import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.extract import _compute_quality_score, extract_pdf


class TestQualityScore:
    def test_empty_text_scores_zero(self):
        assert _compute_quality_score("") == 0.0

    def test_very_short_text_scores_zero(self):
        assert _compute_quality_score("Hi") == 0.0

    def test_clean_legal_text_scores_high(self):
        text = (
            "The Principal Secretary, Public Works Department is hereby directed "
            "to submit a compliance report within 30 days from the date of this order."
        )
        score = _compute_quality_score(text)
        assert score > 0.5, f"Expected score > 0.5 for clean text, got {score}"

    def test_garbled_text_scores_low(self):
        garbled = "\x01\x02\x03\x04\x05" * 20 + "some text"
        score = _compute_quality_score(garbled)
        assert score < 0.5, f"Expected score < 0.5 for garbled text, got {score}"

    def test_score_is_between_zero_and_one(self):
        for text in ["Normal legal text.", "", "a" * 500, "\n\n\n"]:
            score = _compute_quality_score(text)
            assert 0.0 <= score <= 1.0


class TestExtractPdf:
    def _make_pdf(self, tmp_path, text: str, pages: int = 1):
        """Helper: create a minimal digital PDF with fitz."""
        import fitz
        pdf_path = tmp_path / "test.pdf"
        doc = fitz.open()
        for i in range(pages):
            page = doc.new_page()
            page.insert_text((72, 72), f"{text} (page {i+1})", fontsize=11)
        doc.save(str(pdf_path))
        doc.close()
        return str(pdf_path)

    def test_returns_required_keys(self, tmp_path):
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF not installed")
        path = self._make_pdf(tmp_path, "The State shall comply within 30 days.")
        result = extract_pdf(path)
        for key in ["pages", "total_pages", "ocr_pages", "native_pages",
                    "extraction_time_sec", "justification"]:
            assert key in result

    def test_page_data_structure(self, tmp_path):
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF not installed")
        path = self._make_pdf(tmp_path, "Test legal text for extraction.")
        result = extract_pdf(path)
        page_data = result["pages"][0]
        for field in ["page_num", "text", "ocr_used", "quality_score", "char_count"]:
            assert field in page_data, f"Missing field: {field}"

    def test_page_numbers_are_one_indexed(self, tmp_path):
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF not installed")
        path = self._make_pdf(tmp_path, "Legal content.", pages=3)
        result = extract_pdf(path)
        assert [p["page_num"] for p in result["pages"]] == [1, 2, 3]

    def test_digital_pdf_does_not_trigger_ocr(self, tmp_path):
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF not installed")
        long_text = (
            "The respondent is hereby directed to comply with the order of this Court. "
            "The Principal Secretary shall submit a compliance report within 30 days. "
            "Failure to comply shall be treated as contempt of court."
        )
        path = self._make_pdf(tmp_path, long_text)
        result = extract_pdf(path, ocr_quality_threshold=0.4)
        assert result["ocr_pages"] == 0
        assert result["native_pages"] == 1

    def test_justification_mentions_time_saved(self, tmp_path):
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF not installed")
        path = self._make_pdf(tmp_path, "Legal text content.")
        result = extract_pdf(path)
        assert "saved" in result["justification"].lower()

    def test_invalid_path_raises_runtime_error(self):
        with pytest.raises(RuntimeError, match="Cannot open PDF"):
            extract_pdf("/nonexistent/path/to/file.pdf")
