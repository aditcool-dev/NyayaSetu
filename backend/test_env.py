from dotenv import load_dotenv
import os

print("Before:", os.getenv("GEMINI_API_KEY"))
load_dotenv()
print("After:", os.getenv("GEMINI_API_KEY"))
