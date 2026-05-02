# NyayaSetu: Technical Architecture & System Overview

NyayaSetu is a high-performance legal compliance tool designed to transform complex court judgments into actionable, structured workflows for government officials.

## 🚀 Core Technology Stack

### Backend (Python/FastAPI)
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) - High-performance, asynchronous web framework.
- **Server**: [Uvicorn](https://www.uvicorn.org/) - ASGI server for production-grade deployments.
- **Validation**: [Pydantic v2](https://docs.pydantic.dev/) - Strict data validation and settings management.

### Database & Storage (SQLite/SQLAlchemy)
- **Engine**: **SQLite** - Chosen for portability and zero-config deployment.
- **Storage Location**: `backend/nyayasetu.db` (Local file system).
- **ORM**: [SQLAlchemy](https://www.sqlalchemy.org/) - Object-Relational Mapper for clean database interactions.
- **Models**:
  - `Case`: Stores metadata, parties, court info, and the full AI summary.
  - `Directive`: Stores actionable tasks, responsible departments, deadlines, and workflow categories.

### AI Engine (Google Gemini)
- **Model**: **Gemini 2.5/1.5 Flash** - Optimized for high-context legal extraction.
- **Integration**: `google-generativeai` SDK with strict JSON schema enforcement.
- **Workflow Features**:
  - **Categorization**: Directives are automatically grouped into process-driven workflows (e.g., "Custody Resolution").
  - **Conditional Triggers**: Detects "If/Then" dependencies in legal text.
  - **Actionable Rewriting**: Converts dense legalese into clear third-person instructions.

## 📂 System Workflow

### 1. Ingestion & Extraction
- **PDF Extraction**: Uses `pdfplumber` for text-based PDFs and `pytesseract` (OCR) for scanned images.
- **Preprocessing**: OpenCV handles thresholding and grayscale conversion to maximize OCR accuracy on old court documents.

### 2. AI Analysis Pipeline
- The system sends a structured prompt to Gemini with the extracted text.
- **Strict Logic**: The AI is forbidden from hallucinating deadlines; if no date is found, it labels the task as "Immediate / As appropriate."
- **Confidence Scoring**: Assignments of 0.85 to 0.95 based on the clarity of the judge's order.

### 3. Verification Dashboard (React/Vite)
- **UI Components**: Built with Tailwind CSS for a premium, dark-mode legal aesthetic.
- **Action Workflow**:
  - ✅ **Approve**: Persists the directive to the official dashboard.
  - ✏️ **Refine**: Allows manual correction of AI text.
  - ❌ **Flag**: Rejects incorrect extractions.

## 🛠 Project Structure
```text
/backend
├── app/
│   ├── db/             # Database connection & session management
│   ├── models/         # SQLAlchemy Database models
│   ├── schemas/        # Pydantic data schemas
│   ├── routers/        # API endpoints (Cases, Directives, Dashboard)
│   └── services/       # Core logic (PDF, LLM Analyzer, Deadlines)
├── .env                # API Keys and sensitive config
└── nyayasetu.db        # The actual database file
/frontend
├── src/
│   ├── pages/          # Verify Dashboard, Case Upload, Statistics
│   └── services/       # API client logic
```

## 🔐 Database Schema Details
- **Persistence**: Data is stored permanently in the `nyayasetu.db` file.
- **Migrations**: Currently uses `Base.metadata.create_all()` for schema initialization.
- **Relationships**: A One-to-Many relationship exists between `Case` and `Directive` (One case can have multiple actionable tasks).
