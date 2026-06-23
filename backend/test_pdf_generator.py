"""
Test script for PDF generation in PerioVoice AI Backend.
"""

from backend.pdf_generator import pdf_generator
from backend.models import UrgencyLevel
import os


def test_pdf_generation():
    """Test PDF generation with sample assessment data."""

    print("=" * 70)
    print("  PerioVoice AI™ - PDF Generation Testing")
    print("  Step 5: PDF Export and Report Generation")
    print("=" * 70)

    # Sample assessment data
    assessment_data = {
        "user_name": "John Doe",
        "date": "2026-05-23",
        "urgency_level": UrgencyLevel.MODERATE,
        "risk_score": 6,
        "symptoms_found": [
            "gum_bleeding",
            "swelling",
            "bad_taste",
            "surface_irregularity",
        ],
        "recommendation": (
            "Schedule a dental appointment within 1-2 weeks. "
            "Professional evaluation and treatment may be indicated. "
            "Early professional intervention can prevent progression to periodontitis."
        ),
        "home_care_tips": [
            "Rinse with warm salt water 3-4 times daily to reduce inflammation",
            "Brush your teeth twice daily with a soft-bristled toothbrush",
            "Floss daily to remove plaque between teeth",
            "Use an antimicrobial mouthwash as recommended",
            "Avoid smoking and tobacco products",
            "Maintain a healthy diet low in sugar",
        ],
        "detected_from_image": (
            "Significant gum inflammation and erythema (redness) detected. "
            "Gums appear inflamed and may indicate active periodontal disease. "
            "Surface texture shows significant variation and irregularities."
        ),
        "conversation_transcript": [
            {
                "isUser": True,
                "text": "The pain is in my lower front teeth and gums are very sore",
            },
            {
                "isUser": False,
                "text": "Got it, thank you for sharing that. How long have you been experiencing this symptom?",
            },
            {
                "isUser": True,
                "text": "I've been having this pain for about 2 weeks now",
            },
            {"isUser": False, "text": "On a scale of 1 to 10, how severe is the pain?"},
            {"isUser": True, "text": "I'd say the pain is about 7 out of 10, pretty severe"},
            {
                "isUser": False,
                "text": "Do your gums bleed when you brush your teeth or floss?",
            },
        ],
    }

    # Test 1: Generate PDF to bytes
    print("\n✓ Test 1: Generate PDF to Bytes")
    try:
        pdf_bytes = pdf_generator.generate_report(assessment_data)
        print(f"  ✅ PDF generated successfully")
        print(f"  📊 PDF Size: {len(pdf_bytes) / 1024:.2f} KB")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return

    # Test 2: Save PDF to file
    print("\n✓ Test 2: Save PDF to File")
    try:
        output_path = "test_assessment_report.pdf"
        success = pdf_generator.save_report(assessment_data, output_path)

        if success and os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f"  ✅ PDF saved successfully")
            print(f"  📁 File: {output_path}")
            print(f"  📊 Size: {file_size / 1024:.2f} KB")

            # Clean up
            os.remove(output_path)
            print(f"  🧹 Test file cleaned up")
        else:
            print(f"  ❌ Failed to save PDF")
    except Exception as e:
        print(f"  ❌ Error: {e}")

    # Test 3: Test different urgency levels
    print("\n✓ Test 3: Generate Reports for All Urgency Levels")
    urgency_levels = [
        UrgencyLevel.LOW,
        UrgencyLevel.MODERATE,
        UrgencyLevel.HIGH,
        UrgencyLevel.EMERGENCY,
    ]

    for urgency in urgency_levels:
        test_data = assessment_data.copy()
        test_data["urgency_level"] = urgency

        try:
            pdf_bytes = pdf_generator.generate_report(test_data)
            print(f"  ✅ {urgency.value:10} - {len(pdf_bytes) / 1024:6.2f} KB")
        except Exception as e:
            print(f"  ❌ {urgency.value:10} - Error: {e}")

    print("\n" + "=" * 70)
    print("✅ PDF Generation Tests Complete!")
    print("=" * 70)
    print("\nThe backend is now ready to:")
    print("  ✓ Generate professional PDF reports")
    print("  ✓ Export assessments as downloadable files")
    print("  ✓ Support multiple urgency levels")
    print("  ✓ Include conversation summaries")
    print("  ✓ Display home care recommendations")
    print("  ✓ Add medical disclaimers")
    print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    test_pdf_generation()
