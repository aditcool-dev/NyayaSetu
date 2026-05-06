"""
Quick test to identify import errors
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

print("Testing imports...")

try:
    print("1. Testing pipeline.orchestrator...")
    from pipeline.orchestrator import run_pipeline_async
    print("   ✅ orchestrator imported successfully")
except Exception as e:
    print(f"   ❌ orchestrator import failed: {e}")
    import traceback
    traceback.print_exc()

try:
    print("2. Testing pipeline.case_analyzer...")
    from pipeline.case_analyzer import analyze_case_async
    print("   ✅ case_analyzer imported successfully")
except Exception as e:
    print(f"   ❌ case_analyzer import failed: {e}")
    import traceback
    traceback.print_exc()

try:
    print("3. Testing app.routers.pipeline...")
    from app.routers.pipeline import router
    print("   ✅ pipeline router imported successfully")
except Exception as e:
    print(f"   ❌ pipeline router import failed: {e}")
    import traceback
    traceback.print_exc()

try:
    print("4. Testing google.genai...")
    from google import genai
    print("   ✅ google.genai imported successfully")
except Exception as e:
    print(f"   ❌ google.genai import failed: {e}")
    import traceback
    traceback.print_exc()

print("\nAll import tests complete!")
