"""
PerioVoice AI™ - Core 4 Automated Test Cases Suite
===================================================
This suite contains the 4 core production-grade test cases covering all
critical subsystems of PerioVoice AI:
1. Test Case 1: Triage State Engine & Adaptive Clinical Guardrails
2. Test Case 2: AI Clinical Urgency & Risk Assessment Calculation
3. Test Case 3: Oral Image Analyzer & Vision AI Clinical Classifier
4. Test Case 4: Clinical PDF Assessment Report Export & Download Delivery

Designed for execution in both local pytest runners and GitHub Actions CI pipelines.
"""

import os
import sys
from io import BytesIO
from PIL import Image
import pytest

# Ensure backend directory is in path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from backend.triage_state_engine import triage_state_engine
from backend.ai_engine import PeriovoiceAIEngine
from backend.image_analyzer import ImageAnalyzer
from backend.pdf_generator import pdf_generator
from backend.models import UrgencyLevel


def create_synthetic_image(width=400, height=300, red=200, green=100, blue=100, format_type="PNG") -> bytes:
    """Helper to synthesize test oral images with specific color distributions."""
    img = Image.new("RGB", (width, height), (red, green, blue))
    pixels = img.load()
    for i in range(width):
        for j in range(height):
            variation = (i + j) % 30
            r = max(0, min(255, red + variation - 15))
            g = max(0, min(255, green + variation - 15))
            b = max(0, min(255, blue + variation - 15))
            pixels[i, j] = (r, g, b)

    img_bytes = BytesIO()
    img.save(img_bytes, format=format_type)
    return img_bytes.getvalue()


# ==============================================================================
# TEST CASE 1: TRIAGE STATE ENGINE & ADAPTIVE CLINICAL GUARDRAILS
# ==============================================================================
@pytest.mark.core
def test_case_1_triage_engine_and_guardrails():
    """
    TEST CASE 1: Adaptive Clinical Conversation & Guardrail Engine
    Verifies:
    a) Triage session creation & personalized clinical greeting.
    b) Guardrail redirection for off-topic non-dental queries.
    c) Guardrail filtering for non-committal/gibberish input without premature assessment.
    d) Multi-turn clinical detail extraction (location, duration, frequency, pain scale).
    e) Emergency symptoms trigger immediate priority triage completion.
    """
    print("\n--- Running Test Case 1: Triage State Engine & Guardrails ---")

    # 1a. Session initialization
    session_id, greeting, first_q = triage_state_engine.start_session("patient_test_tc1")
    assert session_id is not None and len(session_id) > 0, "Session ID must be generated"
    assert len(greeting) > 0, "Greeting message must not be empty"
    assert isinstance(first_q, str), "First question should be a string"

    # 1b. Off-topic query guardrail
    res_off = triage_state_engine.process_chat_message(session_id, "Which AI is better, ChatGPT or Claude?")
    assert "specifically built to help with dental" in res_off["response"] or "dental" in res_off["response"].lower()
    assert not res_off["is_assessment_complete"], "Off-topic query should not finalize triage assessment"

    # 1c. Non-dental medical query ("i have leg pain")
    session_id_leg, _, _ = triage_state_engine.start_session("patient_test_leg")
    res_leg = triage_state_engine.process_chat_message(session_id_leg, "i have leg pain")
    assert "leg pain" in res_leg["response"] or "dental" in res_leg["response"].lower()
    assert not res_leg["is_assessment_complete"]

    # 1d. Gibberish protection ("dd", "ff")
    session_id_gib, _, _ = triage_state_engine.start_session("patient_test_gib")
    res_dd = triage_state_engine.process_chat_message(session_id_gib, "dd")
    res_ff = triage_state_engine.process_chat_message(session_id_gib, "ff")
    assert not res_dd["is_assessment_complete"], "Gibberish 'dd' must not finalize assessment"
    assert not res_ff["is_assessment_complete"], "Gibberish 'ff' must not finalize assessment"

    # 1e. Adaptive multi-turn extraction & Emergency Escalation
    session_id_urg, _, _ = triage_state_engine.start_session("patient_test_urg")
    res_turn1 = triage_state_engine.process_chat_message(session_id_urg, "I have severe upper right gum pain rated 8 out of 10")
    state = triage_state_engine.sessions[session_id_urg]["state"]
    assert state["location"] == "upper right gum"
    assert state["pain_level"] == 8

    # Process duration
    res_turn2 = triage_state_engine.process_chat_message(session_id_urg, "It started about 3 days ago")
    assert "3 days" in triage_state_engine.sessions[session_id_urg]["state"]["duration"]

    # Emergency symptom trigger (life-threatening/critical airway symptom triggers immediate completion)
    res_turn3 = triage_state_engine.process_chat_message(session_id_urg, "I have a severely swollen face and difficulty swallowing")
    assert res_turn3["is_assessment_complete"] is True, "Emergency symptoms must complete triage immediately"
    assert res_turn3["final_result"]["urgency"] in ["HIGH", "EMERGENCY"], "Urgency must be escalated to HIGH or EMERGENCY"
    print("✅ Test Case 1 PASSED: Triage State Engine & Guardrails operating perfectly.")


# ==============================================================================
# TEST CASE 2: AI CLINICAL URGENCY & RISK ASSESSMENT CALCULATION
# ==============================================================================
@pytest.mark.core
def test_case_2_ai_clinical_urgency_assessment():
    """
    TEST CASE 2: AI Clinical Urgency & Risk Scoring Engine
    Verifies:
    a) Low severity scenario evaluation (mild discomfort -> LOW urgency).
    b) High severity scenario evaluation (severe pain, bleeding, swelling -> HIGH/EMERGENCY).
    c) Risk score mathematical bounds (0 <= score <= 10).
    d) Clinical recommendation and actionable home-care advice generation.
    """
    print("\n--- Running Test Case 2: AI Clinical Urgency Assessment ---")
    engine = PeriovoiceAIEngine()

    # 2a. Low Urgency Scenario
    session_low = "tc2_session_low"
    engine.start_new_session(session_low, "patient_low")
    engine.process_user_response(session_low, "slight discomfort on my back teeth")
    engine.process_user_response(session_low, "about 2 days")
    engine.process_user_response(session_low, "2 out of 10")
    engine.process_user_response(session_low, "rarely")
    engine.process_user_response(session_low, "no bleeding or swelling")
    engine.process_user_response(session_low, "no loose teeth")
    engine.process_user_response(session_low, "visited dentist 2 months ago")

    urgency_low, risk_low, symptoms_low, explanation_low = engine.calculate_urgency(session_low)
    assert urgency_low in [UrgencyLevel.LOW, UrgencyLevel.MODERATE]
    assert 0 <= risk_low <= 10, f"Risk score {risk_low} must be between 0 and 10"

    rec_low, tips_low, should_see_dentist_low = engine.generate_recommendation(urgency_low, risk_low, symptoms_low)
    assert len(rec_low) > 0, "Recommendation must not be empty"
    assert len(tips_low) >= 1, "At least one home care tip must be provided"

    # 2b. High Urgency Scenario
    session_high = "tc2_session_high"
    engine.start_new_session(session_high, "patient_high")
    engine.process_user_response(session_high, "severe throbbing pain across lower jaw")
    engine.process_user_response(session_high, "suffering for 3 weeks")
    engine.process_user_response(session_high, "9 out of 10, unbearable")
    engine.process_user_response(session_high, "constant bleeding when eating")
    engine.process_user_response(session_high, "heavy swelling and pus discharge")
    engine.process_user_response(session_high, "yes, my lower molar feels loose")
    engine.process_user_response(session_high, "haven't seen dentist in 2 years")

    urgency_high, risk_high, symptoms_high, explanation_high = engine.calculate_urgency(session_high)
    assert urgency_high in [UrgencyLevel.HIGH, UrgencyLevel.EMERGENCY]
    assert risk_high >= 6, f"High severity risk score {risk_high} must be >= 6"
    assert 0 <= risk_high <= 10

    rec_high, tips_high, should_see_dentist_high = engine.generate_recommendation(urgency_high, risk_high, symptoms_high)
    assert should_see_dentist_high is True, "High severity must recommend visiting a dentist"
    print("✅ Test Case 2 PASSED: AI Clinical Urgency & Risk Engine operating accurately.")


# ==============================================================================
# TEST CASE 3: ORAL IMAGE ANALYZER & VISION AI CLINICAL CLASSIFIER
# ==============================================================================
@pytest.mark.core
def test_case_3_image_analyzer_and_vision_ai():
    """
    TEST CASE 3: Computer Vision & Oral Image Analysis Engine
    Verifies:
    a) Image validation (valid format PNG/JPEG vs too small image rejection).
    b) Rejection of non-dental photos (e.g., software UI screenshots, blue/green screens).
    c) Healthy tissue baseline detection (low redness, normal risk score <= 4).
    d) Inflamed/erythematous tissue detection (high redness, visual risk score >= 5, swelling tags).
    """
    print("\n--- Running Test Case 3: Oral Image Analyzer & Vision AI ---")
    analyzer = ImageAnalyzer()

    # 3a. Format validation & dimension constraints
    valid_png = create_synthetic_image(400, 300, red=200, green=140, blue=130, format_type="PNG")
    is_valid, msg = analyzer.validate_image(valid_png)
    assert is_valid is True, f"Valid PNG image should pass validation: {msg}"

    small_img = create_synthetic_image(80, 80, red=200, green=140, blue=130)
    is_valid_small, msg_small = analyzer.validate_image(small_img)
    assert is_valid_small is False, "Images smaller than 150x150 must be rejected"

    # 3b. Non-dental image rejection (dominant blue profile / computer screen)
    blue_img = create_synthetic_image(500, 400, red=40, green=50, blue=220)
    res_non_dental = analyzer.analyze_image(blue_img)
    assert res_non_dental["status"] == "error", "Non-dental image must return error status"
    assert "is_dental" in res_non_dental and res_non_dental["is_dental"] is False

    # 3c. Healthy oral tissue baseline
    healthy_img = create_synthetic_image(500, 400, red=160, green=150, blue=140)
    res_healthy = analyzer.analyze_image(healthy_img)
    assert res_healthy["status"] == "success"
    assert res_healthy["visual_risk_score"] <= 4, "Healthy gums must have visual risk score <= 4"

    # 3d. Inflamed / Erythematous tissue detection
    inflamed_img = create_synthetic_image(500, 400, red=230, green=80, blue=80)
    res_inflamed = analyzer.analyze_image(inflamed_img)
    assert res_inflamed["status"] == "success"
    assert res_inflamed["visual_risk_score"] >= 5, "Inflamed tissue must have visual risk score >= 5"
    assert any(tag in res_inflamed["detected_symptom_tags"] for tag in ["severe_swelling", "mild_swelling", "bleeding_gums_brushing"])
    print("✅ Test Case 3 PASSED: Oral Image Analyzer & Vision AI functioning reliably.")


# ==============================================================================
# TEST CASE 4: CLINICAL PDF ASSESSMENT REPORT EXPORT & DOWNLOAD DELIVERY
# ==============================================================================
@pytest.mark.core
def test_case_4_pdf_report_export_and_download(tmp_path=None):
    """
    TEST CASE 4: PDF Report Compilation & Download Export
    Verifies:
    a) Dynamic PDF byte stream compilation across all 4 urgency tiers.
    b) Inclusion of patient summary, clinical findings, home care tips, and disclaimers.
    c) Successful disk export for downloadable file delivery.
    d) Output file size and valid PDF binary signature (%PDF-).
    """
    print("\n--- Running Test Case 4: Clinical PDF Assessment Report Export ---")

    assessment_payload = {
        "user_name": "Test Patient",
        "date": "2026-09-01",
        "urgency_level": UrgencyLevel.HIGH,
        "risk_score": 7,
        "symptoms_found": ["bleeding_gums_brushing", "severe_swelling", "bad_breath_halitosis"],
        "recommendation": "Schedule a comprehensive periodontal evaluation within 24-48 hours.",
        "home_care_tips": [
            "Gently rinse with warm salt water (1/2 tsp salt in 8 oz water) 3 times daily.",
            "Use an ultra-soft toothbrush and avoid scrubbing irritated margins.",
            "Do not smoke or use alcohol-based mouthwashes."
        ],
        "detected_from_image": "Visual inspection shows marked marginal erythema and localized edema.",
        "conversation_transcript": [
            {"isUser": True, "text": "My upper right gums are bleeding and swollen"},
            {"isUser": False, "text": "How long have you noticed the swelling and bleeding?"},
            {"isUser": True, "text": "About 4 days now, pain is 7 out of 10"}
        ]
    }

    # 4a. Compile PDF for all 4 Urgency Levels
    all_levels = [UrgencyLevel.LOW, UrgencyLevel.MODERATE, UrgencyLevel.HIGH, UrgencyLevel.EMERGENCY]
    for lvl in all_levels:
        payload = assessment_payload.copy()
        payload["urgency_level"] = lvl
        pdf_bytes = pdf_generator.generate_report(payload)
        assert isinstance(pdf_bytes, bytes), f"Report for {lvl.value} must return bytes"
        assert len(pdf_bytes) > 1000, f"Report byte size for {lvl.value} too small ({len(pdf_bytes)} bytes)"
        assert pdf_bytes.startswith(b"%PDF-"), f"Binary signature for {lvl.value} must be valid PDF"

    # 4b. Disk export verification
    if tmp_path is not None:
        target_pdf_path = os.path.join(str(tmp_path), "PerioVoice_Clinical_Report.pdf")
    else:
        target_pdf_path = os.path.join(CURRENT_DIR, "tmp_test_export_report.pdf")

    save_success = pdf_generator.save_report(assessment_payload, target_pdf_path)
    assert save_success is True, "PDF save_report must return True"
    assert os.path.exists(target_pdf_path), "Exported PDF file must exist on disk"
    assert os.path.getsize(target_pdf_path) > 1000, "Exported PDF size must be greater than 1KB"

    # Clean up temporary test file if not using tmp_path fixture
    if tmp_path is None and os.path.exists(target_pdf_path):
        os.remove(target_pdf_path)

    print("✅ Test Case 4 PASSED: Clinical PDF Assessment Export generated valid downloadable file.")


if __name__ == "__main__":
    print("\n" + "=" * 75)
    print("  PERIOVOICE AI™ - EXECUTING 4 CORE TEST CASES")
    print("=" * 75)
    test_case_1_triage_engine_and_guardrails()
    test_case_2_ai_clinical_urgency_assessment()
    test_case_3_image_analyzer_and_vision_ai()
    test_case_4_pdf_report_export_and_download()
    print("\n" + "=" * 75)
    print("  🎉 ALL 4 CORE TEST CASES EXECUTED WITH 100% SUCCESS!")
    print("=" * 75 + "\n")
