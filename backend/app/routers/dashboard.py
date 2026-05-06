from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.models.models import Case, Directive, AuditLog
from datetime import datetime, timedelta

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_cases = db.query(Case).count()
    pending_directives = db.query(Directive).filter(Directive.status == "pending").count()
    approved_directives = db.query(Directive).filter(Directive.status == "approved").count()
    rejected_directives = db.query(Directive).filter(Directive.status == "rejected").count()
    total_directives = db.query(Directive).count()
    overdue_directives = db.query(Directive).filter(
        Directive.deadline < datetime.utcnow(),
        Directive.status.in_(["pending", "approved"])
    ).count()
    verified_cases = db.query(Case).filter(Case.status == "verified").count()

    # Dept breakdown
    dept_counts = db.query(
        Directive.responsible_department,
        func.count(Directive.id)
    ).group_by(Directive.responsible_department).all()
    dept_stats = [{"name": d[0], "value": d[1]} for d in dept_counts]

    # Cases by month (last 6 months)
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    cases_by_month_raw = db.query(
        func.strftime('%Y-%m', Case.created_at).label('month'),
        func.count(Case.id).label('count')
    ).filter(Case.created_at >= six_months_ago).group_by('month').order_by('month').all()
    cases_by_month = [{"month": r.month, "count": r.count} for r in cases_by_month_raw]

    # Directives by status per month (last 6 months)
    directives_by_month_raw = db.query(
        func.strftime('%Y-%m', Directive.created_at).label('month'),
        Directive.status,
        func.count(Directive.id).label('count')
    ).filter(Directive.created_at >= six_months_ago).group_by('month', Directive.status).order_by('month').all()

    # Build month-keyed dict
    month_directive_map = {}
    for r in directives_by_month_raw:
        if r.month not in month_directive_map:
            month_directive_map[r.month] = {"month": r.month, "pending": 0, "approved": 0, "rejected": 0}
        month_directive_map[r.month][r.status] = r.count
    directives_by_month = list(month_directive_map.values())

    # Compliance rate = approved / total (non-zero)
    compliance_rate = round((approved_directives / total_directives * 100), 1) if total_directives > 0 else 0

    # Avg directives per case
    avg_directives = round(total_directives / total_cases, 1) if total_cases > 0 else 0

    # Recent audit activity (last 10 actions)
    recent_audits = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10).all()
    recent_activity = [
        {
            "id": a.id,
            "action": a.action,
            "officer_name": a.officer_name,
            "notes": a.notes,
            "timestamp": a.timestamp.isoformat(),
            "directive_id": a.directive_id,
        }
        for a in recent_audits
    ]

    return {
        "total_cases": total_cases,
        "verified_cases": verified_cases,
        "pending_directives": pending_directives,
        "approved_directives": approved_directives,
        "rejected_directives": rejected_directives,
        "total_directives": total_directives,
        "overdue_directives": overdue_directives,
        "compliance_rate": compliance_rate,
        "avg_directives_per_case": avg_directives,
        "department_stats": dept_stats,
        "cases_by_month": cases_by_month,
        "directives_by_month": directives_by_month,
        "recent_activity": recent_activity,
    }
