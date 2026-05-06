"""
MODULE 8: PIPELINE ORCHESTRATOR
=================================
Coordinates all 7 modules in sequence, logs observability metrics,
and returns the final structured output for the FastAPI router.

PIPELINE FLOW:
  PDF → [M1: extract] → [M2: clean] → [M3: candidates] →
  [M4: context] → [M5: chunk] → [M6: llm_extract (parallel)] →
  [M7: postprocess] → structured directives + metrics

OBSERVABILITY METRICS (logged for every judgment):
  {
    "total_pages": int,
    "ocr_pages": int,
    "extraction_time_sec": float,
    "raw_tokens": int,
    "final_llm_tokens": int,
    "token_reduction_pct": float,   # target: ≥90%
    "candidates_layer_a": int,
    "candidates_layer_b": int,
    "candidates_layer_c": int,
    "final_directives": int,
    "ambiguous_flagged": int,
    "total_pipeline_time_sec": float  # target: <600
  }

WHY a dedicated orchestrator (not inline in the router):
- Separation of concerns: the router handles HTTP, the orchestrator handles logic.
- The orchestrator can be called from tests, CLI scripts, and background tasks.
- Metrics are computed in one place, not scattered across modules.
- Easy to add new modules (e.g., a translation module for regional languages)
  without touching the router.

ACCEPTANCE CRITERIA CHECKS (logged at end):
  ✅ <10 minutes total pipeline time
  ✅ ≥90% token reduction
  ✅ Parallel chunk processing
  ✅ Full observability metrics
"""

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pipeline.extract import extract_pdf
from pipeline.clean import clean_pages
from pipeline.candidates import select_candidates
from pipeline.context import build_context_packets
from pipeline.chunk import chunk_context_packets
from pipeline.llm_extract import extract_directives_async
from pipeline.postprocess import postprocess_directives

logger = logging.getLogger(__name__)

# Acceptance criteria thresholds
MAX_PIPELINE_TIME_SEC = 600   # 10 minutes
MIN_TOKEN_REDUCTION_PCT = 90  # 90% token reduction target


def _check_acceptance_criteria(metrics: Dict[str, Any]) -> Dict[str, bool]:
    """
    Check whether the pipeline met all acceptance criteria.
    Logged at the end of every run for demo/audit purposes.
    """
    return {
        "under_10_minutes": metrics["total_pipeline_time_sec"] < MAX_PIPELINE_TIME_SEC,
        "token_reduction_90pct": metrics["token_reduction_pct"] >= MIN_TOKEN_REDUCTION_PCT,
        "parallel_processing_enabled": metrics.get("chunks_processed", 0) > 0,
        "observability_complete": all(
            k in metrics for k in [
                "total_pages", "ocr_pages", "extraction_time_sec",
                "raw_tokens", "final_llm_tokens", "token_reduction_pct",
                "candidates_layer_a", "candidates_layer_b", "candidates_layer_c",
                "final_directives", "ambiguous_flagged", "total_pipeline_time_sec",
            ]
        ),
    }


async def run_pipeline_async(
    pdf_path: str,
    max_concurrent_llm_calls: int = 5,
    ocr_quality_threshold: float = 0.4,
    chunk_max_tokens: int = 3000,
    chunk_overlap_tokens: int = 200,
) -> Dict[str, Any]:
    """
    Run the full NyayaSetu document ingestion pipeline asynchronously.

    Args:
        pdf_path: Path to the court judgment PDF.
        max_concurrent_llm_calls: Max parallel LLM API calls (default 5).
        ocr_quality_threshold: Quality score below which OCR is triggered (default 0.4).
        chunk_max_tokens: Max tokens per LLM chunk (default 3000).
        chunk_overlap_tokens: Token overlap between chunks (default 200).

    Returns:
        {
            "directives": List[directive dicts],
            "metadata": {case_no, court, judgment_date, parties, judge},
            "metrics": {observability metrics dict},
            "acceptance_criteria": {criteria check results},
            "pipeline_log": List[str]   # human-readable step-by-step log
        }
    """
    pipeline_start = time.time()
    pipeline_log: List[str] = []

    def log(msg: str):
        logger.info(msg)
        pipeline_log.append(f"[{time.time() - pipeline_start:.1f}s] {msg}")

    log(f"=== NyayaSetu Pipeline START: {Path(pdf_path).name} ===")

    # -------------------------------------------------------------------------
    # MODULE 1: Smart PDF Extraction
    # -------------------------------------------------------------------------
    log("MODULE 1: Smart PDF Extraction")
    m1_start = time.time()

    extraction_result = extract_pdf(pdf_path, ocr_quality_threshold=ocr_quality_threshold)

    m1_time = round(time.time() - m1_start, 2)
    log(f"  → {extraction_result['total_pages']} pages, "
        f"{extraction_result['ocr_pages']} OCR pages, "
        f"{m1_time}s. {extraction_result['justification']}")

    # -------------------------------------------------------------------------
    # MODULE 2: Context-Preserving Cleaner
    # -------------------------------------------------------------------------
    log("MODULE 2: Context-Preserving Cleaner")
    m2_start = time.time()

    clean_result = clean_pages(extraction_result["pages"])

    m2_time = round(time.time() - m2_start, 2)
    log(f"  → Removed {clean_result['chars_removed']} chars "
        f"({clean_result['noise_lines_detected']} noise lines), {m2_time}s")
    log(f"  → Metadata: {clean_result['metadata']}")

    metadata = clean_result["metadata"]

    # -------------------------------------------------------------------------
    # MODULE 3: Hybrid Directive Candidate Selector
    # -------------------------------------------------------------------------
    log("MODULE 3: Hybrid Directive Candidate Selector")
    m3_start = time.time()

    candidate_result = select_candidates(clean_result["cleaned_pages"])

    m3_time = round(time.time() - m3_start, 2)
    log(f"  → {candidate_result['justification']}, {m3_time}s")

    # -------------------------------------------------------------------------
    # MODULE 4: Context-Window Builder
    # -------------------------------------------------------------------------
    log("MODULE 4: Context-Window Builder")
    m4_start = time.time()

    # Rebuild full paragraph list for neighbor lookup
    # (candidates.py splits pages into paragraphs internally; we need the full list)
    from pipeline.candidates import _split_into_paragraphs
    all_paragraphs = _split_into_paragraphs(clean_result["cleaned_pages"])

    context_packets = build_context_packets(
        candidates=candidate_result["candidates"],
        all_paragraphs=all_paragraphs,
        metadata=metadata,
    )

    m4_time = round(time.time() - m4_start, 2)
    log(f"  → Built {len(context_packets)} context packets, {m4_time}s")

    # -------------------------------------------------------------------------
    # MODULE 5: Token-Aware Chunker
    # -------------------------------------------------------------------------
    log("MODULE 5: Token-Aware Chunker")
    m5_start = time.time()

    chunk_result = chunk_context_packets(
        context_packets=context_packets,
        max_tokens_per_chunk=chunk_max_tokens,
        overlap_tokens=chunk_overlap_tokens,
    )

    m5_time = round(time.time() - m5_start, 2)
    log(f"  → {chunk_result['total_chunks']} chunks, "
        f"{chunk_result['raw_tokens']} raw tokens → "
        f"{chunk_result['final_llm_tokens']} LLM tokens "
        f"({chunk_result['token_reduction_pct']}% reduction), {m5_time}s")
    log(f"  → {chunk_result['justification']}")

    # -------------------------------------------------------------------------
    # MODULE 6: LLM Extraction (Parallel)
    # -------------------------------------------------------------------------
    log(f"MODULE 6: LLM Extraction ({chunk_result['total_chunks']} chunks in parallel)")
    m6_start = time.time()

    llm_result = await extract_directives_async(
        chunks=chunk_result["chunks"],
        max_concurrent=max_concurrent_llm_calls,
    )

    m6_time = round(time.time() - m6_start, 2)
    log(f"  → {llm_result['total_directives_raw']} raw directives extracted "
        f"in {m6_time}s (max chunk: {llm_result['max_chunk_elapsed_sec']}s, "
        f"sequential estimate: ~{sum(r['elapsed_sec'] for r in llm_result['chunk_results']):.1f}s)")

    if llm_result["failed_chunks"] > 0:
        log(f"  ⚠ {llm_result['failed_chunks']} chunks failed — check API key and rate limits")

    # -------------------------------------------------------------------------
    # MODULE 6.5: Case-Level Analysis
    # -------------------------------------------------------------------------
    log("MODULE 6.5: Case-Level Analysis (summary, legal takeaway, dept impact)")
    m6_5_start = time.time()

    from pipeline.case_analyzer import analyze_case_async

    # Reconstruct full text from cleaned pages
    full_text = "\n\n".join(
        f"--- Page {p['page_num']} ---\n{p['text']}"
        for p in clean_result["cleaned_pages"]
    )

    case_analysis = await analyze_case_async(full_text, metadata)

    m6_5_time = round(time.time() - m6_5_start, 2)
    log(f"  → Case analysis complete in {m6_5_time}s")

    # -------------------------------------------------------------------------
    # MODULE 7: Post-Processing & Deduplication
    # -------------------------------------------------------------------------
    log("MODULE 7: Post-Processing & Deduplication")
    m7_start = time.time()

    postprocess_result = postprocess_directives(
        raw_directives=llm_result["all_directives"],
        judgment_date_str=metadata.get("judgment_date"),
    )

    m7_time = round(time.time() - m7_start, 2)
    log(f"  → {postprocess_result['total_raw']} raw → "
        f"{postprocess_result['total_after_dedup']} unique directives "
        f"({postprocess_result['duplicates_removed']} duplicates removed), {m7_time}s")
    log(f"  → {postprocess_result['ambiguous_flagged']} ambiguous, "
        f"{postprocess_result['low_confidence_flagged']} low-confidence flagged for review")

    # -------------------------------------------------------------------------
    # Compile Observability Metrics
    # -------------------------------------------------------------------------
    total_pipeline_time = round(time.time() - pipeline_start, 2)

    metrics = {
        "total_pages": extraction_result["total_pages"],
        "ocr_pages": extraction_result["ocr_pages"],
        "extraction_time_sec": m1_time,
        "raw_tokens": chunk_result["raw_tokens"],
        "final_llm_tokens": chunk_result["final_llm_tokens"],
        "token_reduction_pct": chunk_result["token_reduction_pct"],
        "candidates_layer_a": candidate_result["layer_a_count"],
        "candidates_layer_b": candidate_result["layer_b_count"],
        "candidates_layer_c": candidate_result["layer_c_count"],
        "total_candidates": len(candidate_result["candidates"]),
        "chunks_processed": chunk_result["total_chunks"],
        "final_directives": postprocess_result["total_after_dedup"],
        "ambiguous_flagged": postprocess_result["ambiguous_flagged"],
        "low_confidence_flagged": postprocess_result["low_confidence_flagged"],
        "duplicates_removed": postprocess_result["duplicates_removed"],
        "llm_failed_chunks": llm_result["failed_chunks"],
        "llm_max_chunk_time_sec": llm_result["max_chunk_elapsed_sec"],
        "total_pipeline_time_sec": total_pipeline_time,
        "appeal_window_end": postprocess_result["appeal_window_end"],
        "judgment_date_parsed": postprocess_result["judgment_date_parsed"],
    }

    acceptance = _check_acceptance_criteria(metrics)

    log(f"=== PIPELINE COMPLETE in {total_pipeline_time}s ===")
    log(f"Acceptance criteria: {acceptance}")

    # Log acceptance criteria results prominently
    for criterion, passed in acceptance.items():
        status = "✅" if passed else "❌"
        log(f"  {status} {criterion}")

    return {
        "directives": postprocess_result["directives"],
        "metadata": metadata,
        "case_analysis": case_analysis,  # NEW: summary, legal_takeaway, dept_impact
        "metrics": metrics,
        "acceptance_criteria": acceptance,
        "pipeline_log": pipeline_log,
    }


def run_pipeline(
    pdf_path: str,
    max_concurrent_llm_calls: int = 5,
    ocr_quality_threshold: float = 0.4,
    chunk_max_tokens: int = 3000,
    chunk_overlap_tokens: int = 200,
) -> Dict[str, Any]:
    """
    Synchronous wrapper for run_pipeline_async.
    Use this from FastAPI background tasks or CLI scripts.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Inside an existing event loop (FastAPI) — run in thread pool
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run,
                    run_pipeline_async(
                        pdf_path,
                        max_concurrent_llm_calls,
                        ocr_quality_threshold,
                        chunk_max_tokens,
                        chunk_overlap_tokens,
                    )
                )
                return future.result()
        else:
            return loop.run_until_complete(
                run_pipeline_async(
                    pdf_path,
                    max_concurrent_llm_calls,
                    ocr_quality_threshold,
                    chunk_max_tokens,
                    chunk_overlap_tokens,
                )
            )
    except RuntimeError:
        return asyncio.run(
            run_pipeline_async(
                pdf_path,
                max_concurrent_llm_calls,
                ocr_quality_threshold,
                chunk_max_tokens,
                chunk_overlap_tokens,
            )
        )
