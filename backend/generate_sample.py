from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import os

os.makedirs("sample_pdfs", exist_ok=True)
pdf_path = os.path.join("sample_pdfs", "sample_judgment.pdf")

c = canvas.Canvas(pdf_path, pagesize=letter)
c.setFont("Helvetica-Bold", 16)
c.drawString(100, 750, "IN THE HIGH COURT OF KARNATAKA")
c.setFont("Helvetica", 12)
c.drawString(100, 730, "CASE NUMBER: WP-10293-2024")
c.drawString(100, 710, "DATE: 2024-05-10")

c.drawString(100, 670, "BETWEEN:")
c.drawString(120, 650, "M/s. ABC Infrastructure Pvt Ltd ... Petitioner")
c.drawString(100, 630, "AND:")
c.drawString(120, 610, "State of Karnataka & Others ... Respondents")

c.setFont("Helvetica-Bold", 14)
c.drawString(100, 570, "ORDER")

c.setFont("Helvetica", 12)
text = [
    "1. The petitioner has approached this court seeking compensation for the delay",
    "in acquiring land for the highway project.",
    "",
    "2. Upon hearing both sides, the court directs the following:",
    "",
    "a) The respondent (Revenue Department) is directed to submit a detailed compliance",
    "report regarding the land acquisition status within 30 days.",
    "",
    "b) The petitioner shall be paid an interim compensation of Rs. 10,00,000/- by",
    "the Finance Department within 6 weeks.",
    "",
    "c) The Public Works Department (PWD) must clear the site debris within 15 days",
    "to allow access to the petitioner's adjacent property.",
    "",
    "3. Ordered accordingly."
]

y = 540
for line in text:
    c.drawString(100, y, line)
    y -= 20

c.save()
print(f"Sample PDF created at {pdf_path}")
