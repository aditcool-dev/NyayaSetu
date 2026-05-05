"""
NyayaSetu Pipeline Benchmark Runner
=====================================
Runs the full pipeline on sample PDFs and records acceptance criteria results.

Usage:
    cd backend
    python benchmarks/run_benchmark.py --pdf sample_pdfs/sample.pdf
    python benchmarks/run_benchmark.py --all   # runs on all sample_pdfs/

Output:
    benchmarks/results.json — acceptance criteria proof for demo/judges

Acceptance Criteria:
    ✅ Processes a 50-page judgment in <10 minutes
    ✅ Achieves ≥90% token reduction vs naive full-PDF approach
    ✅ Catches indirect/implied directives (Layer B count > 0)
    ✅ Zero hallucinated authorities (AMBIGUOUS flag used instead)
    ✅ Every directive traceable to source page + paragraph
    ✅ Parallel chunk processing enabled
    ✅ Full observability metrics logged
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def _check_traceability(directives: list) -> dict:
    """Verify every directive has source_page and source_paragraph."""
    total = len(directives)
    if total == 0:
        return {"total": 0, "traceable": 0, "pct": 100.0}

    traceable = sum(
        1 for d in directives
        if d.get("source_page") is not None and d.get("source_paragraph") is not None
    )
    return {
        "total": total,
        "traceable": traceable,
        "pct": round(100 * traceable / total, 1),
    }


def _check_no_hallucinated_authorities(directives: list) -> dict:
    """
    Verify that ambiguous authorities are flagged, not hallucinated.
    A hallucinated authority would be a non-empty string that is NOT "AMBIGUOUS".
    We can't fully verify this without ground truth, but we check that
    the AMBIGUOUS flag is used (not empty strings or generic placeholders).
    """
    total = len(directives)
    if total == 0:
        return {"total": 0, "ambiguous_flagged": 0, "empty_authority": 0}

    ambiguous = sum(1 for d in directives if "AMBIGUOUS" in str(d.get("responsible_authority", "")))
    empty = sum(1 for d in directives if not d.get("responsible_authority", "").strip())

    return {
        "total": total,
        "ambiguous_flagged": ambiguous,
        "empty_authority": empty,
        "hallucination_risk": empty,  # empty authority = potential hallucination
    }


async def _run_single_benchmark(pdf_path: str) -> dict:
    """Run the pipeline on a single PDF and return benchmark results."""
    from pipeline.orchestrator import run_pipeline_async

    print(f"\n{'='*60}")
    print(f"Benchmarking: {Path(pdf_path).name}")
    print(f"{'='*60}")

    start = time.time()
    try:
        result = await run_pipeline_async(pdf_path)
        elapsed = round(time.time() - start, 2)

        metrics = result["metrics"]
        directives = result["directives"]
        acceptance = result["acceptance_criteria"]

        traceability = _check_traceability(directives)
        authority_check = _check_no_hallucinated_authorities(directives)

        # Extended acceptance criteria
        extended_acceptance = {
            **acceptance,
            "implied_directives_caught": metrics.get("candidates_layer_b", 0) > 0,
            "all_directives_traceable": traceability["pct"] == 100.0,
            "no_empty_authorities": authority_check["empty_authority"] == 0,
        }

        benchmark_result = {
            "pdf": Path(pdf_path).name,
            "timestamp": datetime.utcnow().isoformat(),
            "elapsed_sec": elapsed,
            "metrics": metrics,
            "acceptance_criteria": extended_acceptance,
            "traceability": traceability,
            "authority_check": authority_check,
            "directives_sample": directives[:3],  # first 3 for inspection
            "pipeline_log": result["pipeline_log"],
            "passed": all(extended_acceptance.values()),
        }

        # Print summary
        print(f"\nResults for {Path(pdf_path).name}:")
        print(f"  Total pages:          {metrics.get('total_pages', 'N/A')}")
        print(f"  OCR pages:            {metrics.get('ocr_pages', 'N/A')}")
        print(f"  Pipeline time:        {metrics.get('total_pipeline_time_sec', 'N/A')}s")
        print(f"  Token reduction:      {metrics.get('token_reduction_pct', 'N/A')}%")
        print(f"  Layer A candidates:   {metrics.get('candidates_layer_a', 'N/A')}")
        print(f"  Layer B candidates:   {metrics.get('candidates_layer_b', 'N/A')}")
        print(f"  Layer C candidates:   {metrics.get('candidates_layer_c', 'N/A')}")
        print(f"  Final directives:     {metrics.get('final_directives', 'N/A')}")
        print(f"  Ambiguous flagged:    {metrics.get('ambiguous_flagged', 'N/A')}")
        print(f"\nAcceptance Criteria:")
        for criterion, passed in extended_acceptance.items():
            status = "✅" if passed else "❌"
            print(f"  {status} {criterion}")

        return benchmark_result

    except Exception as e:
        elapsed = round(time.time() - start, 2)
        print(f"  ❌ FAILED after {elapsed}s: {e}")
        return {
            "pdf": Path(pdf_path).name,
            "timestamp": datetime.utcnow().isoformat(),
            "elapsed_sec": elapsed,
            "error": str(e),
            "passed": False,
        }


async def run_benchmarks(pdf_paths: list) -> dict:
    """Run benchmarks on all provided PDFs and save results."""
    results = []
    for pdf_path in pdf_paths:
        result = await _run_single_benchmark(pdf_path)
        results.append(result)

    # Aggregate summary
    passed = sum(1 for r in results if r.get("passed", False))
    summary = {
        "benchmark_run": datetime.utcnow().isoformat(),
        "total_pdfs": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "overall_pass": passed == len(results),
        "results": results,
    }

    # Save to benchmarks/results.json
    output_path = Path(__file__).parent / "results.json"
    with open(output_path, "w") as f:
        json.dump(summary, f, indent=2, default=str)

    print(f"\n{'='*60}")
    print(f"BENCHMARK SUMMARY: {passed}/{len(results)} PDFs passed all criteria")
    print(f"Results saved to: {output_path}")
    print(f"{'='*60}")

    return summary


def main():
    parser = argparse.ArgumentParser(description="NyayaSetu Pipeline Benchmark Runner")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pdf", type=str, help="Path to a single PDF to benchmark")
    group.add_argument("--all", action="store_true", help="Benchmark all PDFs in sample_pdfs/")
    args = parser.parse_args()

    if args.pdf:
        pdf_paths = [args.pdf]
    else:
        sample_dir = Path(__file__).parent.parent / "sample_pdfs"
        pdf_paths = list(sample_dir.glob("*.pdf"))
        if not pdf_paths:
            print(f"No PDFs found in {sample_dir}")
            sys.exit(1)
        pdf_paths = [str(p) for p in pdf_paths]

    print(f"Running benchmarks on {len(pdf_paths)} PDF(s)...")
    asyncio.run(run_benchmarks(pdf_paths))


if __name__ == "__main__":
    main()
