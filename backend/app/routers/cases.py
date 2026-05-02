from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Case, Directive
from app.schemas.schemas import Case as CaseSchema
from app.services.pdf_extractor import extract_text_from_pdf
from app.services.llm_analyzer import analyze_judgment
from app.services.deadline_calculator import calculate_absolute_deadline, calculate_appeal_window
import os
import shutil
from datetime import datetime

router = APIRouter(prefix="/cases", tags=["cases"])

UPLOAD_DIR = "sample_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=CaseSchema)
def upload_case(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 1. Extract Text
    extracted = extract_text_from_pdf(file_path)
    
    # 2. Analyze with LLM
    analysis = analyze_judgment(extracted["full_text"])
    if not analysis:
        raise HTTPException(status_code=500, detail="Failed to analyze judgment")
        
    # 3. Save to DB
    try:
        jd_str = analysis.get("judgment_date", datetime.utcnow().isoformat())
        jd_dt = datetime.fromisoformat(jd_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except:
        jd_dt = datetime.utcnow()
        
    db_case = Case(
        case_number=analysis.get("case_number", "Unknown"),
        court=analysis.get("court", "Unknown"),
        judgment_type=analysis.get("judgment_type", "Unknown"),
        classification_confidence=analysis.get("classification_confidence", 0.9),
        judgment_date=jd_dt,
        parties_petitioner=analysis.get("parties", {}).get("petitioner", "Unknown"),
        parties_respondent=analysis.get("parties", {}).get("respondent", "Unknown"),
        summary=analysis.get("summary", ""),
        key_legal_takeaway=analysis.get("key_legal_takeaway"),
        impact_on_departments=analysis.get("impact_on_departments"),
        appeal_window_end=calculate_appeal_window(jd_str),
        pdf_path=file_path,
        status="pending"
    )
    db.add(db_case)
    db.commit()
    db.refresh(db_case)
    
    for dir_data in analysis.get("directives", []):
        raw_dl = dir_data.get("deadline_raw")
        resolved_dl = calculate_absolute_deadline(jd_str, raw_dl)
        
        db_directive = Directive(
            case_id=db_case.id,
            directive_text=dir_data.get("text", ""),
            directive_type=dir_data.get("directive_type", "Mandatory"),
            priority=dir_data.get("priority", "Medium"),
            workflow_category=dir_data.get("workflow_category", "General Compliance"),
            trigger_condition=dir_data.get("trigger_condition"),
            responsible_department=dir_data.get("responsible_department", "Unknown"),
            deadline=resolved_dl,
            confidence_score=dir_data.get("confidence_score", 0.9),
            source_page=dir_data.get("source_page", 1),
            source_text=dir_data.get("source_text", ""),
            status="pending"
        )
        db.add(db_directive)
    
    if len(analysis.get("directives", [])) == 0:
        db_case.status = "verified" # Auto-verify if no directives
        
    db.commit()
    db.refresh(db_case)
    return db_case

@router.get("/", response_model=list[CaseSchema])
def list_cases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    cases = db.query(Case).offset(skip).limit(limit).all()
    return cases

@router.get("/{case_id}", response_model=CaseSchema)
def get_case(case_id: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@router.get("/{case_id}/pdf")
def get_case_pdf(case_id: int, db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse
    case = db.query(Case).filter(Case.id == case_id).first()
    if case is None or not os.path.exists(case.pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(case.pdf_path)
