from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Directive, AuditLog
from app.schemas.schemas import Directive as DirectiveSchema, VerifyDirectiveRequest
from datetime import datetime

router = APIRouter(prefix="/directives", tags=["directives"])

@router.get("/", response_model=list[DirectiveSchema])
def list_directives(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    directives = db.query(Directive).offset(skip).limit(limit).all()
    return directives

@router.put("/{directive_id}/verify", response_model=DirectiveSchema)
def verify_directive(directive_id: int, request: VerifyDirectiveRequest, db: Session = Depends(get_db)):
    directive = db.query(Directive).filter(Directive.id == directive_id).first()
    if not directive:
        raise HTTPException(status_code=404, detail="Directive not found")

    audit = AuditLog(
        directive_id=directive.id,
        action=request.action,
        officer_name=request.officer_name,
        notes=request.notes
    )

    if request.action == "approve":
        directive.status = "approved"
    elif request.action == "reject":
        directive.status = "rejected"
    elif request.action == "edit":
        audit.previous_value = f"Text: {directive.directive_text}, Dept: {directive.responsible_department}"
        if request.edited_text:
            directive.directive_text = request.edited_text
        if request.edited_department:
            directive.responsible_department = request.edited_department
        if request.edited_deadline:
            directive.deadline = request.edited_deadline
        audit.new_value = f"Text: {directive.directive_text}, Dept: {directive.responsible_department}"
        directive.status = "approved"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    db.add(audit)
    db.commit()
    db.refresh(directive)
    
    # Check if all directives for the case are actioned to update case status
    pending_count = db.query(Directive).filter(Directive.case_id == directive.case_id, Directive.status == "pending").count()
    if pending_count == 0:
        directive.case.status = "verified"
        db.commit()
        
    return directive
