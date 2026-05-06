"""
Quick test for the case analyzer module.
Run this to verify case-level analysis is working correctly.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from pipeline.case_analyzer import analyze_case_async


async def test_case_analyzer():
    """Test case analyzer with sample judgment text."""
    
    sample_text = """
    HIGH COURT OF KARNATAKA AT BENGALURU
    
    MFA No. 4617 of 2022
    
    BETWEEN:
    Shahistha, Fayaz, Rajesh Achary, Sukanya (Petitioners)
    AND
    The State, represented by LPO, DCPU, Rajathadri, Manipal (Respondents)
    
    JUDGMENT
    
    This appeal was filed by biological parents and alleged adoptive parents against 
    the dismissal of their petition for guardianship under the Guardians and Wards Act, 1890. 
    
    The case involved an unregistered agreement for the adoption of an 'unborn child' between 
    Hindu biological parents and Muslim alleged adoptive parents. The High Court upheld the 
    trial court's dismissal, finding the agreement invalid as Mohammedan Law does not recognize 
    adoption and emphasizing the legal procedures for child surrender under the Juvenile Justice 
    (Care and Protection of Children) Act, 2015.
    
    The court noted that the child was allegedly 'sold' and a criminal case was pending. 
    The child is currently in the welfare custody of a recognized center. The biological parents 
    expressed willingness to take the child back, leading to specific directives for the Child 
    Welfare Committee and the Police.
    
    DIRECTIVES:
    
    1. The Child Welfare Committee shall conduct an inquiry within 30 days to determine the 
       best interests of the child.
    
    2. The Jurisdictional Police shall investigate the allegations of child trafficking and 
       submit a report within 45 days.
    
    3. The District Child Protection Unit shall ensure the child's welfare during the inquiry 
       period and provide necessary support services.
    
    This judgment reinforces the importance of following legal procedures for adoption and 
    child welfare, and highlights the role of Child Welfare Committees in protecting children's 
    rights.
    """
    
    metadata = {
        "case_no": "MFA No. 4617 of 2022",
        "court": "High Court of Karnataka at Bengaluru",
        "judgment_date": "2022-11-30",
        "parties_petitioner": "Shahistha, Fayaz, Rajesh Achary, Sukanya",
        "parties_respondent": "The State, represented by LPO, DCPU, Rajathadri, Manipal",
    }
    
    print("=" * 80)
    print("Testing Case Analyzer Module")
    print("=" * 80)
    print(f"\nCase: {metadata['case_no']}")
    print(f"Court: {metadata['court']}")
    print(f"\nAnalyzing judgment text ({len(sample_text)} characters)...")
    print()
    
    result = await analyze_case_async(sample_text, metadata)
    
    print("=" * 80)
    print("RESULTS")
    print("=" * 80)
    print()
    
    print("📝 AI SUMMARY:")
    print("-" * 80)
    print(result.get("summary", "N/A"))
    print()
    
    print("⚖️  LEGAL TAKEAWAY:")
    print("-" * 80)
    print(result.get("legal_takeaway", "N/A"))
    print()
    
    print("🏛️  DEPARTMENTAL IMPACT:")
    print("-" * 80)
    print(result.get("departmental_impact", "N/A"))
    print()
    
    print("=" * 80)
    print(f"Analysis completed in {result.get('elapsed_sec', 0)}s")
    print("=" * 80)
    
    # Verify all fields are present
    assert result.get("summary"), "Summary is missing!"
    assert result.get("legal_takeaway"), "Legal takeaway is missing!"
    assert result.get("departmental_impact"), "Departmental impact is missing!"
    
    print("\n✅ All checks passed!")


if __name__ == "__main__":
    # Check for API key
    if not os.getenv("GEMINI_API_KEY"):
        print("❌ Error: GEMINI_API_KEY environment variable not set")
        print("Please set it in your .env file or export it:")
        print("  export GEMINI_API_KEY='your-api-key-here'")
        sys.exit(1)
    
    asyncio.run(test_case_analyzer())
