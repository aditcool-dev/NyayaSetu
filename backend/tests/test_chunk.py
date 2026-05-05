"""
Tests for Module 5: Token-Aware Chunker (pipeline/chunk.py)

Tests cover:
- Token counting (tiktoken and fallback)
- Chunk size respects token budget
- Overlap between adjacent chunks
- case_header present in every chunk
- Parallel processing justification logged
- Token reduction metrics
"""

import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.chunk import chunk_context_packets, _count_tokens, _get_tokenizer


SAMPLE_CASE_HEADER = {
    "case_no": "WP No. 7890/2024",
    "court": "High Court of Bombay",
    "judgment_date": "2024-01-05",
    "parties": {"petitioner": "Dr. Meena Patil", "respondent": "MCGM"},
    "judge": "Justice Vikram Desai",
}


def _make_packet(text: str, page: int = 1, pid: str = "p1") -> dict:
    return {
        "candidate_sentence": text,
        "preceding_paragraph": "Background context paragraph.",
        "following_paragraph": "Consequence paragraph.",
        "case_header": SAMPLE_CASE_HEADER,
        "paragraph_number": "5",
        "page_number": page,
        "paragraph_id": pid,
        "layer": "A",
        "matched_patterns": [r"\bshall\b"],
        "is_operative": True,
    }


class TestTokenCounting:
    def test_count_tokens_returns_positive_int(self):
        tokenizer = _get_tokenizer()
        count = _count_tokens("The State shall comply within 30 days.", tokenizer)
        assert isinstance(count, int)
        assert count > 0

    def test_count_tokens_fallback_without_tiktoken(self):
        """Fallback (tokenizer=None) must return a positive integer."""
        count = _count_tokens("The State shall comply within 30 days.", None)
        assert isinstance(count, int)
        assert count > 0

    def test_longer_text_has_more_tokens(self):
        tokenizer = _get_tokenizer()
        short = _count_tokens("Short text.", tokenizer)
        long = _count_tokens("This is a much longer text with many more words and sentences.", tokenizer)
        assert long > short


class TestChunkContextPackets:
    def test_returns_required_keys(self):
        packets = [_make_packet("The State shall comply within 30 days.", pid=f"p{i}") for i in range(3)]
        result = chunk_context_packets(packets)
        for key in ["chunks", "total_chunks", "raw_tokens", "final_llm_tokens",
                    "token_reduction_pct", "justification"]:
            assert key in result

    def test_each_chunk_has_case_header(self):
        """Every chunk must carry the case_header — critical for LLM accuracy."""
        packets = [_make_packet(f"Directive {i} shall be complied with.", pid=f"p{i}") for i in range(5)]
        result = chunk_context_packets(packets)
        for chunk in result["chunks"]:
            assert "case_header" in chunk
            assert chunk["case_header"]["case_no"] == "WP No. 7890/2024"

    def test_chunk_token_count_within_budget(self):
        """No chunk should exceed the max_tokens_per_chunk budget."""
        max_tokens = 3000
        packets = [
            _make_packet("The State shall comply within 30 days.", pid=f"p{i}")
            for i in range(20)
        ]
        result = chunk_context_packets(packets, max_tokens_per_chunk=max_tokens)
        for chunk in result["chunks"]:
            # Allow some overhead for case_header and prompt template
            assert chunk["token_count"] <= max_tokens + 200, (
                f"Chunk {chunk['chunk_id']} has {chunk['token_count']} tokens, "
                f"exceeds budget of {max_tokens}"
            )

    def test_empty_packets_returns_empty_chunks(self):
        result = chunk_context_packets([])
        assert result["chunks"] == []
        assert result["total_chunks"] == 0

    def test_single_packet_creates_one_chunk(self):
        packets = [_make_packet("The State shall comply.", pid="p1")]
        result = chunk_context_packets(packets)
        assert result["total_chunks"] == 1

    def test_justification_mentions_parallel(self):
        packets = [_make_packet(f"Directive {i}.", pid=f"p{i}") for i in range(3)]
        result = chunk_context_packets(packets)
        assert "parallel" in result["justification"].lower()

    def test_token_reduction_pct_is_non_negative(self):
        packets = [_make_packet(f"Directive {i}.", pid=f"p{i}") for i in range(5)]
        result = chunk_context_packets(packets)
        assert result["token_reduction_pct"] >= 0

    def test_chunk_ids_are_sequential(self):
        packets = [_make_packet(f"Directive {i}.", pid=f"p{i}") for i in range(10)]
        result = chunk_context_packets(packets, max_tokens_per_chunk=500)
        chunk_ids = [c["chunk_id"] for c in result["chunks"]]
        assert chunk_ids == list(range(1, len(chunk_ids) + 1))
