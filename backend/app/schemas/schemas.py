from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

class DirectiveBase(BaseModel):
    directive_text: str
    directive_type: str
    priority: str
    workflow_category: str
    trigger_condition: Optional[str] = None
    responsible_department: str
    deadline: Optional[datetime]
    confidence_score: float
    source_page: int
    source_text: str

class DirectiveCreate(DirectiveBase):
    pass

class Directive(DirectiveBase):
    id: int
    case_id: int
    status: str
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class CaseBase(BaseModel):
    case_number: str
    court: str
    judgment_type: str
    classification_confidence: float
    judgment_date: datetime
    parties_petitioner: str
    parties_respondent: str
    summary: str
    key_legal_takeaway: Optional[str] = None
    impact_on_departments: Optional[str] = None
    appeal_window_end: datetime
    pdf_path: str

class CaseCreate(CaseBase):
    pass

class Case(CaseBase):
    id: int
    status: str
    created_at: datetime
    directives: List[Directive] = []

    class Config:
        orm_mode = True
        from_attributes = True

class AuditLogBase(BaseModel):
    action: str
    officer_name: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    directive_id: int

class AuditLog(AuditLogBase):
    id: int
    directive_id: int
    timestamp: datetime

    class Config:
        orm_mode = True
        from_attributes = True
        
class VerifyDirectiveRequest(BaseModel):
    action: str # approve, reject, edit
    officer_name: str
    notes: Optional[str] = None
    edited_text: Optional[str] = None
    edited_department: Optional[str] = None
    edited_deadline: Optional[datetime] = None
