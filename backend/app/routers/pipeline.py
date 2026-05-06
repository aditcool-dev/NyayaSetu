"""
FastAPI router for the NyayaSetu document ingestion pipeline.

Exposes:
  POST /api/v1/pipeline/process  — Upload a PDF and run the full pipeline
  GET  /api/v1/pipeline/metrics/{case_id}  — Retrieve pipeline metrics for a case
  GET  /api/v1/pipeline/health   — Check pipeline dependencies

This router replaces the old /cases/upload endpoint for new pipeline-processed cases.
The old endpoint is preserved for backward compatibility.
"""

import asyncio
import json
import logging
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Case, Directive

# Add backend root to path so pipeline imports work
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

UPLOAD_DIR = "sample_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _save_upload(file: UploadFile) -> str:
    """Save uploaded file to disk and return the path."""
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return file_path


def _persist_to_db(
    pipeline_result: Dict[str, Any],
    pdf_path: str,
    db: Session,
) -> Case:
    """
    Persist pipeline results to the database.

    Maps pipeline output fields to the existing Case and Directive models
    for compatibility with the existing frontend.
    """
    metadata = pipeline_result.get("metadata", {})
    metrics = pipeline_result.get("metrics", {})
    directives = pipeline_result.get("directives", [])
    case_analysis = pipeline_result.get("case_analysis", {})

    # Parse judgment date
    jd_str = metadata.get("judgment_date") or metrics.get("judgment_date_parsed")
    try:
        if jd_str:
            jd_dt = datetime.strptime(jd_str, "%Y-%m-%d")
        else:
            jd_dt = datetime.utcnow()
    except ValueError:
        jd_dt = datetime.utcnow()

    # Appeal window
    appeal_end_str = metrics.get("appeal_window_end")
    try:
        appeal_end = datetime.strptime(appeal_end_str, "%Y-%m-%d") if appeal_end_str else None
    except ValueError:
        appeal_end = None

    if not appeal_end:
        from datetime import timedelta
        appeal_end = jd_dt + timedelta(days=90)

    # Use case analysis for summary and insights (with fallbacks)
    summary = case_analysis.get("summary") if case_analysis else None
    
    if not summary:
        # Fallback to simple summary if case analysis failed
        summary = (
            f"{metadata.get('case_no', 'Case')} - "
            f"{metadata.get('court', 'Court')}. "
            f"{metrics.get('final_directives', 0)} directives extracted."
        )

    legal_takeaway = case_analysis.get("legal_takeaway") if case_analysis else None
    dept_impact = case_analysis.get("departmental_impact") if case_analysis else None

    db_case = Case(
        case_number=metadata.get("case_no") or "Unknown",
        court=metadata.get("court") or "Unknown",
        judgment_type="Directive",
        classification_confidence=0.9,
        judgment_date=jd_dt,
        parties_petitioner=metadata.get("parties_petitioner") or "Unknown",
        parties_respondent=metadata.get("parties_respondent") or "Unknown",
        summary=summary,
        key_legal_takeaway=legal_takeaway,
        impact_on_departments=dept_impact,
        appeal_window_end=appeal_end,
        pdf_path=pdf_path,
        status="pending",
    )
    db.add(db_case)
    db.commit()
    db.refresh(db_case)

    # Map directive fields to existing Directive model
    for d in directives:
        # Map directive_type to existing model values
        dtype_map = {
            "explicit": "Mandatory",
            "implied": "Advisory",
            "conditional": "Conditional",
        }
        dtype = dtype_map.get(d.get("directive_type", "").lower(), "Mandatory")

        # Map confidence to priority
        confidence = d.get("confidence", 0.7)
        if confidence >= 0.85:
            priority = "High"
        elif confidence >= 0.70:
            priority = "Medium"
        else:
            priority = "Low"

        # Parse deadline
        deadline_str = d.get("deadline_absolute")
        deadline_dt = None
        if deadline_str:
            try:
                deadline_dt = datetime.strptime(deadline_str, "%Y-%m-%d")
            except ValueError:
                pass

        db_directive = Directive(
            case_id=db_case.id,
            directive_text=d.get("directive_text", ""),
            directive_type=dtype,
            priority=priority,
            workflow_category="Pipeline Extraction",
            trigger_condition=d.get("deadline_relative"),  # reuse field for context
            responsible_department=d.get("responsible_authority", "AMBIGUOUS — human review required"),
            deadline=deadline_dt,
            confidence_score=confidence,
            source_page=d.get("source_page", 0),
            source_text=d.get("source_paragraph", ""),
            status="pending",
        )
        db.add(db_directive)

    db.commit()
    db.refresh(db_case)
    return db_case


@router.post("/process")
async def process_judgment(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a court judgment PDF and run the full NyayaSetu pipeline.

    Returns the case record with all extracted directives and pipeline metrics.
    This is the primary endpoint for the new pipeline-based ingestion.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_path = _save_upload(file)
    
    logger.info(f"Processing file: {file.filename} at {file_path}")

    try:
        # Import here to avoid circular imports and allow path setup
        from pipeline.orchestrator import run_pipeline_async
        
        logger.info("Starting pipeline execution...")
        pipeline_result = await run_pipeline_async(file_path)
        logger.info(f"Pipeline completed successfully. Directives: {len(pipeline_result.get('directives', []))}")

    except ImportError as e:
        logger.error(f"Import error in pipeline: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Pipeline module import failed: {str(e)}. Check that all dependencies are installed."
        )
    except Exception as e:
        logger.error(f"Pipeline failed for {file.filename}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Pipeline processing failed: {str(e)}"
        )

    # Persist to DB
    try:
        logger.info("Persisting results to database...")
        db_case = _persist_to_db(pipeline_result, file_path, db)
        logger.info(f"Case saved with ID: {db_case.id}")
    except Exception as e:
        logger.error(f"DB persistence failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save results to database: {str(e)}"
        )

    return {
        "case_id": db_case.id,
        "case_number": db_case.case_number,
        "court": db_case.court,
        "summary": db_case.summary,
        "legal_takeaway": db_case.key_legal_takeaway,
        "departmental_impact": db_case.impact_on_departments,
        "directives_count": len(pipeline_result["directives"]),
        "metrics": pipeline_result["metrics"],
        "acceptance_criteria": pipeline_result["acceptance_criteria"],
        "pipeline_log": pipeline_result["pipeline_log"],
        "directives": pipeline_result["directives"],
    }


@router.get("/metrics/{case_id}")
def get_pipeline_metrics(case_id: int, db: Session = Depends(get_db)):
    """
    Retrieve stored pipeline metrics for a case.
    Metrics are stored in the key_legal_takeaway field as JSON.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    try:
        metrics = json.loads(case.key_legal_takeaway or "{}")
        acceptance = json.loads(case.impact_on_departments or "{}")
    except (json.JSONDecodeError, TypeError):
        metrics = {}
        acceptance = {}

    return {
        "case_id": case_id,
        "case_number": case.case_number,
        "metrics": metrics,
        "acceptance_criteria": acceptance,
    }


@router.get("/health")
def pipeline_health():
    """
    Check that all pipeline dependencies are available.
    Returns status for each dependency.
    """
    health = {
        "pymupdf": False,
        "pytesseract": False,
        "tiktoken": False,
        "sentence_transformers": False,
        "google_generativeai": False,
        "gemini_api_key": False,
    }

    try:
        import fitz
        health["pymupdf"] = True
    except ImportError:
        pass

    try:
        import pytesseract
        health["pytesseract"] = True
    except ImportError:
        pass

    try:
        import tiktoken
        health["tiktoken"] = True
    except ImportError:
        pass

    try:
        from sentence_transformers import SentenceTransformer
        health["sentence_transformers"] = True
    except ImportError:
        pass

    try:
        import google.genai  # new SDK
        health["google_generativeai"] = True
    except ImportError:
        try:
            import google.generativeai  # old SDK fallback
            health["google_generativeai"] = True
        except ImportError:
            pass

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    health["gemini_api_key"] = bool(api_key and len(api_key) > 10)

    all_critical = health["pymupdf"] and health["google_generativeai"] and health["gemini_api_key"]

    return {
        "status": "healthy" if all_critical else "degraded",
        "dependencies": health,
        "notes": {
            "pytesseract": "Optional — only needed for scanned PDFs",
            "tiktoken": "Optional — falls back to char-based approximation",
            "sentence_transformers": "Optional — falls back to exact string deduplication",
        }
    }


@router.get("/debug/{case_id}")
def debug_case_directives(case_id: int, db: Session = Depends(get_db)):
    """
    Debug endpoint to check directive data for a case.
    Shows raw directive data to help diagnose extraction issues.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    directives_debug = []
    for d in case.directives:
        directives_debug.append({
            "id": d.id,
            "directive_text": d.directive_text,
            "directive_text_length": len(d.directive_text) if d.directive_text else 0,
            "source_text": d.source_text,
            "source_text_length": len(d.source_text) if d.source_text else 0,
            "source_page": d.source_page,
            "responsible_department": d.responsible_department,
            "confidence_score": d.confidence_score,
            "status": d.status,
        })
    
    return {
        "case_id": case_id,
        "case_number": case.case_number,
        "total_directives": len(case.directives),
        "directives": directives_debug,
    }
