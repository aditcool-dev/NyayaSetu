from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base

class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_number = Column(String, index=True)
    court = Column(String)
    judgment_date = Column(DateTime)
    judgment_type = Column(String, default="Directive")
    classification_confidence = Column(Float, default=0.9)
    parties_petitioner = Column(String)
    parties_respondent = Column(String)
    summary = Column(String)
    key_legal_takeaway = Column(String, nullable=True)
    impact_on_departments = Column(String, nullable=True)
    appeal_window_end = Column(DateTime)
    pdf_path = Column(String)
    status = Column(String, default="pending")  # pending, verified, closed
    created_at = Column(DateTime, default=datetime.utcnow)

    directives = relationship("Directive", back_populates="case")

class Directive(Base):
    __tablename__ = "directives"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    directive_text = Column(String)
    directive_type = Column(String, default="Mandatory") # Mandatory, Advisory, Conditional
    priority = Column(String, default="Medium") # High, Medium, Low
    workflow_category = Column(String, default="General Compliance")
    trigger_condition = Column(String, nullable=True)
    responsible_department = Column(String)
    deadline = Column(DateTime, nullable=True)
    status = Column(String, default="pending")  # pending, approved, rejected, overdue, completed
    confidence_score = Column(Float)
    source_page = Column(Integer)
    source_text = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="directives")
    audit_logs = relationship("AuditLog", back_populates="directive")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    directive_id = Column(Integer, ForeignKey("directives.id"))
    action = Column(String)  # approve, edit, reject
    officer_name = Column(String)
    previous_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    directive = relationship("Directive", back_populates="audit_logs")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    name_kn = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
