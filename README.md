# NyayaSetu AI Compliance Engine

NyayaSetu is a high-performance legal compliance tool designed to transform complex court judgments into actionable, structured workflows for government officials. It leverages advanced AI (Google Gemini) to extract tasks, categorize directives, and create an intuitive verification dashboard.

---

## 🚀 Core Technologies

### Backend
- **Python & FastAPI**: High-performance, asynchronous web framework.
- **SQLite & SQLAlchemy**: Portable database with robust ORM.
- **Google Gemini**: AI Engine for extracting and structuring legal workflows.
- **PDF Processing**: `pdfplumber` and `pytesseract` (OCR) for document ingestion.

### Frontend
- **React & Vite**: Extremely fast modern web development environment.
- **Tailwind CSS**: Premium, dark-mode styling and UI components.
- **Framer Motion**: Smooth, dynamic workflow animations.

---

## 📂 Project Structure

- `/backend`: The FastAPI application, AI logic, and database schemas.
- `/frontend`: The Vite/React web application and UI components.
- `SYSTEM_ARCHITECTURE.md`: Detailed technical breakdown of the ingestion pipeline and database architecture.

---

## 🛠️ How to Run the Project Locally

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **Google Gemini API Key**

### 1. Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   - Create a file named `.env` inside the `backend/` directory.
   - Add your Gemini API Key:
     ```env
     GEMINI_API_KEY=your_api_key_here
     ```
5. Start the backend server:
   ```bash
   uvicorn app.main:app --reload
   ```
   *The backend API will be available at [http://127.0.0.1:8000](http://127.0.0.1:8000)*

### 2. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will be available at [http://localhost:5173](http://localhost:5173)*

---

## 💡 Usage

Once both servers are running:
1. Open your browser and navigate to `http://localhost:5173`.
2. Use the dashboard to upload a court judgment PDF.
3. The backend will parse the PDF and pass it through the Gemini model.
4. Review the extracted directives in the **Verification Dashboard**, where you can approve, refine, or flag the AI's output.
