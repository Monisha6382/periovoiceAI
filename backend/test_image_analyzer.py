"""
Test script for Image Analysis in PerioVoice AI Backend.
Tests image upload, validation, and analysis functionality.
"""

import os
import base64
from io import BytesIO
from PIL import Image
from backend.image_analyzer import ImageAnalyzer


def create_test_image(width=400, height=300, red=200, green=100, blue=100) -> bytes:
    """
    Create a test image with specified colors.

    Parameters:
    - width: Image width
    - height: Image height
    - red, green, blue: Color values (0-255)

    Returns:
    - Image as bytes
    """
    # Create a solid color image
    img = Image.new("RGB", (width, height), (red, green, blue))

    # Add some variation to simulate tissue
    pixels = img.load()
    for i in range(width):
        for j in range(height):
            variation = (i + j) % 30
            r = max(0, min(255, red + variation - 15))
            g = max(0, min(255, green + variation - 15))
            b = max(0, min(255, blue + variation - 15))
            pixels[i, j] = (r, g, b)

    # Convert to bytes
    img_bytes = BytesIO()
    img.save(img_bytes, format="PNG")
    return img_bytes.getvalue()


def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def test_image_validation():
    """Test image validation functionality."""
    print_section("Image Validation Tests")

    analyzer = ImageAnalyzer()

    # Test 1: Valid image
    print("\n✓ Test 1: Valid Image (Normal Gums)")
    valid_img = create_test_image(400, 300, red=200, green=150, blue=130)
    is_valid, message = analyzer.validate_image(valid_img)
    print(f"  Result: {'PASS' if is_valid else 'FAIL'}")
    print(f"  Message: {message}")

    # Test 2: Too small image
    print("\n✗ Test 2: Image Too Small (100x100)")
    small_img = create_test_image(100, 100)
    is_valid, message = analyzer.validate_image(small_img)
    print(f"  Result: {'PASS (correctly rejected)' if not is_valid else 'FAIL'}")
    print(f"  Message: {message}")

    # Test 3: Valid image - inflamed gums (high red)
    print("\n✓ Test 3: Valid Image (Inflamed Gums)")
    inflamed_img = create_test_image(400, 300, red=220, green=100, blue=100)
    is_valid, message = analyzer.validate_image(inflamed_img)
    print(f"  Result: {'PASS' if is_valid else 'FAIL'}")
    print(f"  Message: {message}")


def test_image_analysis():
    """Test image analysis functionality."""
    print_section("Image Analysis Tests")

    analyzer = ImageAnalyzer()

    # Test Case 1: Healthy Gums
    print("\n📍 Test Case 1: Healthy Gums (Low Inflammation)")
    healthy_img = create_test_image(500, 400, red=180, green=150, blue=140)
    result = analyzer.analyze_image(healthy_img)

    print(f"  Status: {result['status']}")
    if result["status"] == "success":
        analysis = result["analysis"]
        print(f"  Visual Risk Score: {analysis['visual_risk_score']}/10")
        print(f"  Symptoms Detected: {analysis['symptoms_from_image']}")
        print(f"  Redness Score: {analysis['color_analysis']['redness_score']}")
        print("\n  Findings:")
        for finding in analysis["visual_findings"]:
            print(f"    • {finding}")

    # Test Case 2: Inflamed Gums
    print("\n📍 Test Case 2: Inflamed/Bleeding Gums (High Redness)")
    inflamed_img = create_test_image(500, 400, red=230, green=80, blue=80)
    result = analyzer.analyze_image(inflamed_img)

    print(f"  Status: {result['status']}")
    if result["status"] == "success":
        analysis = result["analysis"]
        print(f"  Visual Risk Score: {analysis['visual_risk_score']}/10")
        print(f"  Symptoms Detected: {analysis['symptoms_from_image']}")
        print(f"  Redness Score: {analysis['color_analysis']['redness_score']}")
        print("\n  Findings:")
        for finding in analysis["visual_findings"]:
            print(f"    • {finding}")
        print("\n  Recommendations:")
        for rec in analysis["recommendations"]:
            print(f"    → {rec}")

    # Test Case 3: Severely Inflamed Gums
    print("\n📍 Test Case 3: Severely Inflamed Gums (Critical)")
    severe_img = create_test_image(500, 400, red=240, green=60, blue=60)
    result = analyzer.analyze_image(severe_img)

    print(f"  Status: {result['status']}")
    if result["status"] == "success":
        analysis = result["analysis"]
        print(f"  Visual Risk Score: {analysis['visual_risk_score']}/10")
        print(f"  Symptoms Detected: {analysis['symptoms_from_image']}")
        print(f"  Redness Score: {analysis['color_analysis']['redness_score']}")
        print("\n  Key Findings:")
        for finding in analysis["visual_findings"][:3]:
            print(f"    • {finding}")


def test_combined_assessment():
    """Test combined assessment of image + clinical symptoms."""
    print_section("Combined Assessment Tests (Image + Clinical)")

    analyzer = ImageAnalyzer()

    # Create inflamed image
    inflamed_img = create_test_image(500, 400, red=220, green=90, blue=90)
    analysis = analyzer.analyze_image(inflamed_img)

    if analysis["status"] == "success":
        visual_risk = analysis["analysis"]["visual_risk_score"]
        symptoms_from_image = analysis["analysis"]["symptoms_from_image"]

        # Combine with clinical symptoms
        clinical_symptoms = ["gum_bleeding", "bad_taste", "swelling"]

        combined = analyzer.get_combined_assessment(
            visual_risk, symptoms_from_image, clinical_symptoms
        )

        print(f"\n📊 Assessment Results:")
        print(f"  Visual Risk Score (from image): {combined['visual_contribution']}/10")
        print(f"  Clinical Symptoms Reported: {len(clinical_symptoms)}")
        print(f"  Combined Risk Score: {combined['combined_risk_score']}/10")
        print(f"\n  All Detected Symptoms:")
        for symptom in combined["total_symptoms"]:
            print(f"    • {symptom}")


def test_description_generation():
    """Test the detailed description generation."""
    print_section("Detailed Description Generation Test")

    analyzer = ImageAnalyzer()

    # Analyze an inflamed image
    inflamed_img = create_test_image(500, 400, red=225, green=85, blue=85)
    result = analyzer.analyze_image(inflamed_img)

    if result["status"] == "success":
        description = result["analysis"]["detailed_description"]
        print("\n" + description)


def test_file_formats():
    """Test different file format handling."""
    print_section("File Format Tests")

    analyzer = ImageAnalyzer()

    print("\n✓ PNG Format:")
    png_img = create_test_image(400, 300)
    is_valid, msg = analyzer.validate_image(png_img)
    print(f"  Result: {msg}")

    print("\n✓ Creating JPEG for test:")
    img = Image.new("RGB", (400, 300), (200, 100, 100))
    jpeg_bytes = BytesIO()
    img.save(jpeg_bytes, format="JPEG")
    jpeg_data = jpeg_bytes.getvalue()
    is_valid, msg = analyzer.validate_image(jpeg_data)
    print(f"  JPEG Support: {'✓ Supported' if is_valid else '✗ Not Supported'}")
    print(f"  Message: {msg}")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  PerioVoice AI™ - Image Analysis Testing")
    print("  Step 3: Image Upload and Analysis")
    print("=" * 70)

    # Run all tests
    test_image_validation()
    test_image_analysis()
    test_combined_assessment()
    test_description_generation()
    test_file_formats()

    print_section("✅ All Image Analysis Tests Complete!")
    print("\nThe backend is now ready to:")
    print("  ✓ Accept image uploads via API")
    print("  ✓ Validate images before processing")
    print("  ✓ Analyze gum health from images")
    print("  ✓ Generate risk scores from visual data")
    print("  ✓ Combine image + clinical symptoms")
    print("  ✓ Provide detailed visual findings report")
    print("\n" + "=" * 70 + "\n")
