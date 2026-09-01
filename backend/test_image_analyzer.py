"""
Test script for Image Analysis in PerioVoice AI Backend.
Tests image upload, validation, and analysis functionality.
"""

import os
import sys
from io import BytesIO
from PIL import Image

# Ensure backend can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.image_analyzer import ImageAnalyzer


def create_test_image(width=400, height=300, red=200, green=100, blue=100) -> bytes:
    """
    Create a test image with specified colors.
    """
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

    img_bytes = BytesIO()
    img.save(img_bytes, format="PNG")
    return img_bytes.getvalue()


def print_section(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def test_image_validation():
    print_section("Image Validation Tests")
    analyzer = ImageAnalyzer()

    # Test 1: Valid image
    print("\n✓ Test 1: Valid Image")
    valid_img = create_test_image(400, 300, red=200, green=150, blue=130)
    is_valid, message = analyzer.validate_image(valid_img)
    print(f"  Result: {'PASS' if is_valid else 'FAIL'}")
    print(f"  Message: {message}")
    assert is_valid

    # Test 2: Too small image
    print("\n✗ Test 2: Image Too Small (100x100)")
    small_img = create_test_image(100, 100)
    is_valid, message = analyzer.validate_image(small_img)
    print(f"  Result: {'PASS (correctly rejected)' if not is_valid else 'FAIL'}")
    print(f"  Message: {message}")
    assert not is_valid


def test_image_analysis():
    print_section("Image Analysis Tests")
    analyzer = ImageAnalyzer()

    # Test Case 1: Healthy Gums
    print("\n📍 Test Case 1: Healthy Gums (Low Inflammation)")
    healthy_img = create_test_image(500, 400, red=160, green=150, blue=140)
    result = analyzer.analyze_image(healthy_img)

    print(f"  Status: {result['status']}")
    if result["status"] == "success":
        print(f"  Visual Risk Score: {result['visual_risk_score']}/10")
        print(f"  Symptoms Detected: {result['detected_symptom_tags']}")
        print(f"  Recommendation: {result['recommendation']}")
        assert result['visual_risk_score'] <= 4
    else:
        assert False, "Should succeed"

    # Test Case 2: Inflamed Gums
    print("\n📍 Test Case 2: Inflamed/Bleeding Gums (High Redness)")
    inflamed_img = create_test_image(500, 400, red=230, green=80, blue=80)
    result = analyzer.analyze_image(inflamed_img)

    print(f"  Status: {result['status']}")
    if result["status"] == "success":
        print(f"  Visual Risk Score: {result['visual_risk_score']}/10")
        print(f"  Symptoms Detected: {result['detected_symptom_tags']}")
        print(f"  Recommendation: {result['recommendation']}")
        assert result['visual_risk_score'] >= 5
        assert any(tag in result['detected_symptom_tags'] for tag in ["severe_swelling", "mild_swelling", "bleeding_gums_brushing"])
    else:
        assert False, "Should succeed"

    # Test Case 3: Rejection of Non-Dental Image (Blue background)
    print("\n📍 Test Case 3: Rejection of Non-Dental Image (Mostly Blue)")
    blue_img = create_test_image(500, 400, red=50, green=60, blue=220)
    result = analyzer.analyze_image(blue_img)

    print(f"  Status: {result['status']}")
    print(f"  Message: {result['message']}")
    assert result['status'] == "error"
    assert "doesn't look like a photo of teeth or gums" in result['message']


def test_file_formats():
    print_section("File Format Tests")
    analyzer = ImageAnalyzer()

    print("\n✓ PNG Format:")
    png_img = create_test_image(400, 300)
    is_valid, msg = analyzer.validate_image(png_img)
    print(f"  Result: {msg}")
    assert is_valid

    print("\n✓ Creating JPEG for test:")
    img = Image.new("RGB", (400, 300), (200, 100, 100))
    jpeg_bytes = BytesIO()
    img.save(jpeg_bytes, format="JPEG")
    jpeg_data = jpeg_bytes.getvalue()
    is_valid, msg = analyzer.validate_image(jpeg_data)
    print(f"  JPEG Support: {'✓ Supported' if is_valid else '✗ Not Supported'}")
    assert is_valid


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  PerioVoice AI™ - Image Analysis Testing")
    print("=" * 70)

    test_image_validation()
    test_image_analysis()
    test_file_formats()

    print_section("✅ All Image Analysis Tests Complete!")
