import pdfplumber
import pytesseract
import cv2
import numpy as np
from PIL import Image
import os
import platform

# Auto-detect Tesseract path based on OS
if platform.system() == 'Windows':
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# On macOS/Linux, tesseract is found via PATH automatically

def preprocess_image(image: Image.Image) -> Image.Image:
    open_cv_image = np.array(image)
    open_cv_image = open_cv_image[:, :, ::-1].copy() 
    gray = cv2.cvtColor(open_cv_image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return Image.fromarray(thresh)

def extract_text_from_pdf(pdf_path: str) -> dict:
    pages_data = []
    total_pages = 0
    extraction_method = "pdfplumber"
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text and len(text.strip()) > 50:
                    pages_data.append({
                        "page_num": i + 1,
                        "text": text,
                        "method": "pdfplumber"
                    })
                else:
                    extraction_method = "hybrid"
                    pages_data.append({
                        "page_num": i + 1,
                        "text": "",
                        "method": "needs_ocr"
                    })
    except Exception as e:
        print(f"Error reading PDF with pdfplumber: {e}")
        extraction_method = "ocr_only"
        
    # Process pages that need OCR
    if any(p["method"] == "needs_ocr" for p in pages_data) or extraction_method == "ocr_only":
        with pdfplumber.open(pdf_path) as pdf:
            for i, p_data in enumerate(pages_data):
                if p_data["method"] == "needs_ocr":
                    page = pdf.pages[i]
                    im = page.to_image(resolution=300).original
                    processed_im = preprocess_image(im)
                    text = pytesseract.image_to_string(processed_im)
                    pages_data[i]["text"] = text
                    pages_data[i]["method"] = "tesseract_ocr"
                    
    full_text = "\n\n".join([f"--- Page {p['page_num']} ---\n{p['text']}" for p in pages_data])
    
    return {
        "full_text": full_text,
        "pages": pages_data,
        "total_pages": total_pages,
        "metadata": {"extraction_method": extraction_method}
    }
