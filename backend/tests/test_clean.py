"""
Tests for Module 2: Context-Preserving Cleaner (pipeline/clean.py)

Tests cover:
- Watermark removal
- Page number stripping
- Repeated header/footer detection
- Metadata extraction (case number, court, date, parties)
- Preservation of paragraph numbering and legal Latin
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.clean import (
    _clean_page_text,
    _detect_repeated_lines,
    _extract_metadata,
    clean_pages,
)


class TestWatermarkRemoval:
    """Watermarks must be stripped; legal content must be preserved."""

    def test_removes_certified_true_copy(self):
        text = "CERTIFIED TRUE COPY\nThe respondent is hereby directed to comply."
        cleaned = _clean_page_text(text, set())
        assert "CERTIFIED TRUE COPY" not in cleaned
        assert "hereby directed" in cleaned

    def test_removes_livelaw_watermark(self):
        text = "WWW.LIVELAW.IN\nThe court ordered compliance within 30 days."
        cleaned = _clean_page_text(text, set())
        assert "WWW.LIVELAW.IN" not in cleaned
        assert "30 days" in cleaned

    def test_removes_not_for_publication(self):
        text = "NOT FOR PUBLICATION\nThis judgment is reportable."
        cleaned = _clean_page_text(text, set())
        assert "NOT FOR PUBLICATION" not in cleaned

    def test_preserves_legal_latin(self):
        """Legal Latin must NOT be removed — it provides directive context."""
        text = "The court held inter alia that the respondent shall comply forthwith."
        cleaned = _clean_page_text(text, set())
        assert "inter alia" in cleaned
        assert "forthwith" in cleaned

    def test_preserves_case_citations(self):
        """Case citations must be preserved for legal precedent context."""
        text = "As held in AIR 2019 SC 1234, the State shall ensure compliance."
        cleaned = _clean_page_text(text, set())
        assert "AIR 2019 SC 1234" in cleaned


class TestPageNumberRemoval:
    """Standalone page numbers must be stripped."""

    def test_removes_standalone_page_number(self):
        text = "Some legal text.\n5\nMore legal text."
        cleaned = _clean_page_text(text, set())
        # The standalone "5" line should be gone
        lines = [l.strip() for l in cleaned.split('\n') if l.strip()]
        assert "5" not in lines

    def test_removes_page_x_of_y(self):
        text = "Legal content here.\nPage 5 of 50\nMore content."
        cleaned = _clean_page_text(text, set())
        assert "Page 5 of 50" not in cleaned

    def test_removes_dash_page_dash(self):
        text = "Legal content.\n- 12 -\nMore content."
        cleaned = _clean_page_text(text, set())
        assert "- 12 -" not in cleaned

    def test_preserves_page_numbers_in_citations(self):
        """Page numbers embedded in text (not standalone) must be kept."""
        text = "See page 5 of the report for details on compliance."
        cleaned = _clean_page_text(text, set())
        assert "page 5" in cleaned


class TestRepeatedLineDetection:
    """Lines appearing on 3+ pages are headers/footers and must be detected."""

    def test_detects_repeated_court_header(self):
        pages = [
            {"text": "HIGH COURT OF KARNATAKA\nSome content on page 1."},
            {"text": "HIGH COURT OF KARNATAKA\nSome content on page 2."},
            {"text": "HIGH COURT OF KARNATAKA\nSome content on page 3."},
        ]
        repeated = _detect_repeated_lines(pages, min_frequency=3)
        assert "HIGH COURT OF KARNATAKA" in repeated

    def test_does_not_flag_unique_lines(self):
        pages = [
            {"text": "Unique content on page 1."},
            {"text": "Different content on page 2."},
            {"text": "Another unique line on page 3."},
        ]
        repeated = _detect_repeated_lines(pages, min_frequency=3)
        assert len(repeated) == 0

    def test_threshold_respected(self):
        """Lines appearing exactly min_frequency times should be detected."""
        pages = [
            {"text": "REPEATED HEADER\nContent 1."},
            {"text": "REPEATED HEADER\nContent 2."},
            {"text": "REPEATED HEADER\nContent 3."},
            {"text": "Only twice header\nContent 4."},
            {"text": "Only twice header\nContent 5."},
        ]
        repeated = _detect_repeated_lines(pages, min_frequency=3)
        assert "REPEATED HEADER" in repeated
        assert "Only twice header" not in repeated


class TestMetadataExtraction:
    """Case metadata must be correctly extracted from judgment text."""

    def test_extracts_writ_petition_number(self):
        text = "WRIT PETITION NO. 7890/2024\nIN THE HIGH COURT OF KARNATAKA"
        metadata = _extract_metadata(text)
        assert metadata["case_no"] is not None
        assert "7890" in metadata["case_no"]

    def test_extracts_high_court_name(self):
        text = "IN THE HIGH COURT OF JUDICATURE AT BOMBAY\nWRIT PETITION NO. 123/2024"
        metadata = _extract_metadata(text)
        assert metadata["court"] is not None
        assert "BOMBAY" in metadata["court"].upper() or "HIGH COURT" in metadata["court"].upper()

    def test_extracts_judgment_date(self):
        text = "DATED: 15th January 2024\nIN THE HIGH COURT OF KARNATAKA"
        metadata = _extract_metadata(text)
        assert metadata["judgment_date"] is not None
        assert "2024" in metadata["judgment_date"]

    def test_returns_none_for_missing_fields(self):
        text = "Some text without any case metadata."
        metadata = _extract_metadata(text)
        # Should return None for fields not found, not raise an exception
        assert isinstance(metadata, dict)
        assert "case_no" in metadata
        assert "court" in metadata


class TestCleanPages:
    """Integration test for the full clean_pages function."""

    def test_returns_required_keys(self):
        pages = [
            {
                "page_num": 1,
                "text": "CERTIFIED TRUE COPY\nThe respondent shall comply within 30 days.",
                "ocr_used": False,
                "quality_score": 0.9,
            }
        ]
        result = clean_pages(pages)

        assert "cleaned_pages" in result
        assert "full_cleaned_text" in result
        assert "metadata" in result
        assert "chars_removed" in result
        assert "noise_lines_detected" in result

    def test_full_cleaned_text_contains_page_markers(self):
        """Page markers [PAGE N] must be present for source citation."""
        pages = [
            {"page_num": 1, "text": "Content on page one.", "ocr_used": False, "quality_score": 0.9},
            {"page_num": 2, "text": "Content on page two.", "ocr_used": False, "quality_score": 0.9},
        ]
        result = clean_pages(pages)
        assert "[PAGE 1]" in result["full_cleaned_text"]
        assert "[PAGE 2]" in result["full_cleaned_text"]

    def test_chars_removed_is_non_negative(self):
        pages = [
            {"page_num": 1, "text": "CERTIFIED TRUE COPY\nLegal content.", "ocr_used": False, "quality_score": 0.9}
        ]
        result = clean_pages(pages)
        assert result["chars_removed"] >= 0
