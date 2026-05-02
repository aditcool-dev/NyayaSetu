from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.models.models import Case, Directive
from datetime import datetime

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_cases = db.query(Case).count()
    pending_directives = db.query(Directive).filter(Directive.status == "pending").count()
    overdue_directives = db.query(Directive).filter(Directive.deadline < datetime.utcnow(), Directive.status.in_(["pending", "approved"])).count()
    
    # Dept breakdown
    dept_counts = db.query(Directive.responsible_department, func.count(Directive.id)).group_by(Directive.responsible_department).all()
    dept_stats = [{"name": d[0], "value": d[1]} for d in dept_counts]
    
    return {
        "total_cases": total_cases,
        "pending_directives": pending_directives,
        "overdue_directives": overdue_directives,
        "department_stats": dept_stats
    }
