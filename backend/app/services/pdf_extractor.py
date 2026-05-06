import fitz  # PyMuPDF
import os

def extract_text_from_pdf(pdf_path: str) -> dict:
    pages_data = []
    total_pages = 0
    extraction_method = "pymupdf"
    
    try:
        # PyMuPDF is extremely fast and memory efficient
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        
        for i, page in enumerate(doc):
            # Extract text
            text = page.get_text("text")
            
            if text and len(text.strip()) > 50:
                pages_data.append({
                    "page_num": i + 1,
                    "text": text,
                    "method": "pymupdf"
                })
            else:
                pages_data.append({
                    "page_num": i + 1,
                    "text": "[Text extraction failed. Document may be a scanned image. OCR is disabled on free tier to prevent memory crashes.]",
                    "method": "skipped"
                })
                
        doc.close()
    except Exception as e:
        print(f"Error reading PDF with PyMuPDF: {e}")
        extraction_method = "error"
        
    full_text = "\n\n".join([f"--- Page {p['page_num']} ---\n{p['text']}" for p in pages_data])
    
    return {
        "full_text": full_text,
        "pages": pages_data,
        "total_pages": total_pages,
        "metadata": {"extraction_method": extraction_method}
    }
