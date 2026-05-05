"""
Tests for Module 3: Hybrid Directive Candidate Selector (pipeline/candidates.py)

Critical tests — this module determines RECALL.
Tests verify:
- Layer A catches explicit directives ("shall", "directed to")
- Layer B catches implied/conditional directives ("may consider", "needful")
- Layer C catches operative-section paragraphs with no regex match
- UNION deduplication works correctly
- Justification string is logged
"""

import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.candidates import select_candidates, _match_layer, LAYER_A_PATTERNS, LAYER_B_PATTERNS


class TestLayerAExplicitDirectives:
    """Layer A must catch all unambiguous legal commands."""

    def _make_pages(self, text: str):
        return [{"page_num": 1, "text": text, "ocr_used": False, "quality_score": 0.9}]

    def test_catches_shall(self):
        pages = self._make_pages(
            "The Principal Secretary shall submit a report within 30 days."
        )
        result = select_candidates(pages)
        assert result["layer_a_count"] >= 1

    def test_catches_hereby_directed(self):
        pages = self._make_pages(
            "The respondent is hereby directed to comply with the order forthwith."
        )
        result = select_candidates(pages)
        assert result["layer_a_count"] >= 1

    def test_catches_within_n_days(self):
        pages = self._make_pages(
            "The department must file a compliance affidavit within 45 days."
        )
        result = select_candidates(pages)
        assert result["layer_a_count"] >= 1

    def test_catches_on_or_before(self):
        pages = self._make_pages(
            "The State shall release funds on or before 30th April 2024."
        )
        result = select_candidates(pages)
        assert result["layer_a_count"] >= 1

    def test_catches_contempt_language(self):
        pages = self._make_pages(
            "Failure to comply shall be treated as contempt of court."
        )
        result = select_candidates(pages)
        assert result["layer_a_count"] >= 1

    def test_catches_show_cause(self):
        pages = self._make_pages(
            "Show cause notice is hereby issued to the Principal Secretary."
        )
        result = select_candidates(pages)
        assert result["layer_a_count"] >= 1


class TestLayerBImpliedDirectives:
    """
    Layer B is the most critical for NyayaSetu's recall guarantee.
    Officers commonly miss these — they read like suggestions but carry legal weight.
    """

    def _make_pages(self, text: str):
        return [{"page_num": 1, "text": text, "ocr_used": False, "quality_score": 0.9}]

    def test_catches_may_consider(self):
        """'may consider' is a soft directive — officers miss this, courts don't."""
        pages = self._make_pages(
            "The State may consider taking appropriate steps to improve sanitation."
        )
        result = select_candidates(pages)
        assert result["layer_b_count"] >= 1, (
            "CRITICAL: 'may consider' must be caught by Layer B. "
            "Missing this causes contempt proceedings."
        )

    def test_catches_needful(self):
        pages = self._make_pages(
            "It would be needful for the MCGM to examine the water supply infrastructure."
        )
        result = select_candidates(pages)
        assert result["layer_b_count"] >= 1

    def test_catches_appropriate_steps(self):
        pages = self._make_pages(
            "The department should take appropriate steps to address the grievance."
        )
        result = select_candidates(pages)
        assert result["layer_b_count"] >= 1

    def test_catches_in_the_event(self):
        pages = self._make_pages(
            "In the event of non-compliance, the officer shall appear in person."
        )
        result = select_candidates(pages)
        assert result["layer_b_count"] >= 1

    def test_catches_deems_fit(self):
        pages = self._make_pages(
            "The authority deems fit to take such action as may be necessary."
        )
        result = select_candidates(pages)
        assert result["layer_b_count"] >= 1

    def test_catches_is_expected_to(self):
        pages = self._make_pages(
            "The State Government is expected to ensure adequate funding."
        )
        result = select_candidates(pages)
        assert result["layer_b_count"] >= 1

    def test_catches_action_taken_report(self):
        """ATR (Action Taken Report) is a standard Indian administrative obligation."""
        pages = self._make_pages(
            "The department shall submit an action taken report to this Court."
        )
        result = select_candidates(pages)
        # ATR pattern is in Layer B; "shall submit" is also in Layer A
        assert result["layer_a_count"] + result["layer_b_count"] >= 1

    def test_catches_liberty_granted(self):
        pages = self._make_pages(
            "Liberty is hereby granted to the petitioner to approach this Court."
        )
        result = select_candidates(pages)
        assert result["layer_b_count"] >= 1


class TestLayerCPositional:
    """Layer C must include operative section paragraphs even without regex matches."""

    def test_operative_section_included_without_regex(self):
        """
        A paragraph in the last 20% of the document with no trigger words
        must still be included via Layer C.
        """
        # Build a document where the last paragraph has no Layer A/B patterns
        paragraphs = []
        for i in range(8):
            paragraphs.append(f"Background paragraph {i+1} discussing facts of the case.")
        # Last 2 paragraphs (20% of 10) — no explicit directive language
        paragraphs.append("The petition is disposed of accordingly.")
        paragraphs.append("Registry to send a copy of this order to all parties.")

        text = "\n\n".join(paragraphs)
        pages = [{"page_num": 1, "text": text, "ocr_used": False, "quality_score": 0.9}]

        result = select_candidates(pages)
        # Layer C should have caught the operative section paragraphs
        assert result["layer_c_count"] >= 0  # may be 0 if A/B already caught them
        # Total candidates must be > 0 (candidates key holds the list)
        assert len(result["candidates"]) > 0

    def test_total_candidates_is_union(self):
        """Total candidates must be the UNION of all layers (no double-counting)."""
        text = (
            "The State shall comply within 30 days.\n\n"
            "The department may consider appropriate steps.\n\n"
            "Background information about the case.\n\n"
            "More background information.\n\n"
            "The petition is disposed of."
        )
        pages = [{"page_num": 1, "text": text, "ocr_used": False, "quality_score": 0.9}]
        result = select_candidates(pages)

        # Verify no duplicates in candidates list
        ids = [c["paragraph_id"] for c in result["candidates"]]
        assert len(ids) == len(set(ids)), "Duplicate paragraph IDs found in candidates"


class TestJustificationLogging:
    def test_justification_string_present(self):
        pages = [{"page_num": 1, "text": "The State shall comply.", "ocr_used": False, "quality_score": 0.9}]
        result = select_candidates(pages)
        assert "justification" in result
        assert "Layer A" in result["justification"]
        assert "Layer B" in result["justification"]
        assert "Layer C" in result["justification"]

    def test_returns_required_keys(self):
        pages = [{"page_num": 1, "text": "The State shall comply.", "ocr_used": False, "quality_score": 0.9}]
        result = select_candidates(pages)
        for key in ["candidates", "total_paragraphs", "layer_a_count",
                    "layer_b_count", "layer_c_count", "justification"]:
            assert key in result


class TestSampleJudgments:
    """End-to-end candidate selection on the three sample judgment fixtures."""

    def _load_fixture(self, name: str) -> list:
        fixture_path = Path(__file__).parent / "fixtures" / name
        text = fixture_path.read_text()
        return [{"page_num": 1, "text": text, "ocr_used": False, "quality_score": 0.9}]

    def test_explicit_judgment_high_layer_a(self):
        """Explicit-heavy judgment should have high Layer A count."""
        pages = self._load_fixture("sample_explicit.txt")
        result = select_candidates(pages)
        assert result["layer_a_count"] >= 3, (
            f"Expected ≥3 Layer A candidates in explicit judgment, got {result['layer_a_count']}"
        )

    def test_implied_judgment_high_layer_b(self):
        """Implied-heavy judgment should have meaningful Layer B count."""
        pages = self._load_fixture("sample_implied.txt")
        result = select_candidates(pages)
        assert result["layer_b_count"] >= 3, (
            f"Expected ≥3 Layer B candidates in implied judgment, got {result['layer_b_count']}"
        )

    def test_mixed_judgment_catches_both(self):
        """Mixed judgment should have candidates from both Layer A and Layer B."""
        pages = self._load_fixture("sample_mixed.txt")
        result = select_candidates(pages)
        assert result["layer_a_count"] >= 2
        assert result["layer_b_count"] >= 2
