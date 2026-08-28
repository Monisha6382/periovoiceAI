"""
Test script for PerioVoice AI Backend.
Run this to test the AI conversation logic.
"""

from backend.ai_engine import PeriovoiceAIEngine
from backend.models import UrgencyLevel
import json


def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def test_ai_conversation():
    """
    Test the complete AI conversation flow with sample user responses.
    """
    print_section("PerioVoice AI - Backend Testing")

    # Initialize AI engine
    engine = PeriovoiceAIEngine()

    # Start a new session
    session_id = "test_session_001"
    user_id = "user_001"

    greeting, first_question = engine.start_new_session(session_id, user_id)
    print(f"\n🤖 AI Greeting:\n{greeting}")
    print(f"\n❓ {first_question}")

    # Simulate user responses to questions
    sample_responses = [
        "The pain is in my lower front teeth and gums are very sore",
        "I've been having this pain for about 2 weeks now",
        "I'd say the pain is about 7 out of 10, pretty severe",
        "Yes, my gums bleed quite a bit when I brush and floss",
        "There's some swelling in my gums and sometimes I notice a bad taste in my mouth",
        "No, fortunately my teeth feel stable and don't move",
        "My last dental visit was about 8 months ago",
    ]

    print_section("Simulating User Conversation")

    # Process each response
    for i, response in enumerate(sample_responses):
        print(f"\n👤 User (Response {i+1}):\n{response}")

        ai_response, is_complete = engine.process_user_response(session_id, response)

        print(f"\n🤖 AI Response:\n{ai_response}")

        if not is_complete:
            next_q = engine.get_next_question(session_id)
            print(f"\n❓ {next_q}")

        if is_complete:
            break

    # Calculate urgency and generate final assessment
    print_section("Final Assessment Calculation")

    urgency, risk_score, symptoms, explanation = engine.calculate_urgency(session_id)

    print(f"\n📊 Assessment Results:")
    print(f"   Urgency Level: {urgency.value}")
    print(f"   Risk Score: {risk_score}/10")
    print(f"   Symptoms Detected: {symptoms}")
    print(f"   Explanation: {explanation}")

    # Generate recommendation
    recommendation, home_care_tips, should_see_dentist = engine.generate_recommendation(
        urgency, risk_score, symptoms
    )

    print(f"\n💬 Recommendation:\n{recommendation}")
    print(f"\n🏥 Should See Dentist: {should_see_dentist}")

    print_section("Home Care Tips")
    for i, tip in enumerate(home_care_tips, 1):
        print(f"{i}. {tip}")

    # Save session data
    session_data = engine.get_session_data(session_id)

    print_section("Session Data (For Database)")
    print(json.dumps(
        {
            "user_id": session_data["user_id"],
            "question_count": len(sample_responses),
            "symptoms_found": symptoms,
            "final_assessment": {
                "urgency_level": urgency.value,
                "risk_score": risk_score,
                "recommendation": recommendation,
            }
        },
        indent=2
    ))

    print("\n" + "=" * 60)
    print("✅ Test Complete!")
    print("=" * 60 + "\n")


def test_different_severity_levels():
    """Test different symptom combinations to see urgency levels."""

    print_section("Testing Different Severity Levels")

    engine = PeriovoiceAIEngine()

    # Test Case 1: Mild symptoms
    print("\n📍 Test Case 1: Mild Symptoms")
    session1 = "test_mild"
    engine.start_new_session(session1, "user_mild")
    engine.process_user_response(session1, "slight discomfort on my back teeth")
    engine.process_user_response(session1, "about 3 days")
    engine.process_user_response(session1, "2 out of 10")
    engine.process_user_response(session1, "rarely")
    engine.process_user_response(session1, "no, none of those")
    engine.process_user_response(session1, "no")
    engine.process_user_response(session1, "visited my dentist last month")

    urgency, risk, symptoms, _ = engine.calculate_urgency(session1)
    print(f"   Result: {urgency.value} (Risk Score: {risk}/10)")
    print(f"   Symptoms: {symptoms}")

    # Test Case 2: Severe symptoms
    print("\n📍 Test Case 2: Severe Symptoms")
    session2 = "test_severe"
    engine.start_new_session(session2, "user_severe")
    engine.process_user_response(session2, "severe pain across entire lower jaw")
    engine.process_user_response(session2, "suffering for 3 months")
    engine.process_user_response(session2, "9 out of 10, unbearable")
    engine.process_user_response(session2, "constant bleeding")
    engine.process_user_response(session2, "lots of swelling and pus discharge")
    engine.process_user_response(session2, "yes, some teeth feel loose")
    engine.process_user_response(session2, "haven't been to dentist for 2 years")

    urgency, risk, symptoms, _ = engine.calculate_urgency(session2)
    print(f"   Result: {urgency.value} (Risk Score: {risk}/10)")
    print(f"   Symptoms: {symptoms}")


def test_clinical_chat_bugs():
    """Verify specific bug fixes (Off-topic, Gibberish guard, short inputs, corrections, Tamil)."""
    print_section("Verifying Specific Bug Fixes")
    engine = PeriovoiceAIEngine()

    # BUG 1 Test Case: "i have leg pain"
    print("\n📍 Test Bug 1: Leg pain redirection")
    session_bug1 = "test_bug1"
    engine.start_new_session(session_bug1, "user_bug1")
    resp, is_complete = engine.process_user_response(session_bug1, "i have leg pain")
    print(f"   Input: 'i have leg pain'")
    print(f"   AI Response: {resp}")
    assert "leg pain" in resp or "specifically built" in resp
    assert not is_complete

    # BUG 1 Test Case: "nothing"
    print("\n📍 Test Bug 1: Non-committal 'nothing'")
    session_nothing = "test_nothing"
    engine.start_new_session(session_nothing, "user_nothing")
    resp, is_complete = engine.process_user_response(session_nothing, "nothing")
    print(f"   Input: 'nothing'")
    print(f"   AI Response: {resp}")
    assert "No worries" in resp or "whenever" in resp
    assert not is_complete

    # BUG 2 Test Case: "dd" then "ff" (gibberish should never trigger assessment)
    print("\n📍 Test Bug 2: Gibberish 'dd' and 'ff' repeated 5 times")
    session_gibberish = "test_gibberish"
    engine.start_new_session(session_gibberish, "user_gibberish")
    for turn in range(5):
        resp, is_complete = engine.process_user_response(session_gibberish, "dd" if turn % 2 == 0 else "ff")
        print(f"   Turn {turn+1} Input: {'dd' if turn % 2 == 0 else 'ff'}")
        print(f"   AI Response: {resp}")
        assert not is_complete, "ERROR: Gibberish triggered an assessment!"
        assert "catch" in resp or "understand" in resp or "words" in resp

    # BUG 3 & 5 Test Case: "my gums bleed when i brush" -> "up"
    print("\n📍 Test Bug 3 & 5: Short keyword 'up' recognized as 'upper'")
    session_short = "test_short"
    engine.start_new_session(session_short, "user_short")
    resp1, _ = engine.process_user_response(session_short, "my gums bleed when i brush")
    print(f"   Input 1: 'my gums bleed when i brush'")
    
    resp2, _ = engine.process_user_response(session_short, "up")
    print(f"   Input 2: 'up' (answering duration/location)")
    print(f"   AI Response 2: {resp2}")
    
    sess_data = engine.engine.sessions[session_short]
    print(f"   Stored State: {sess_data['state']}")
    assert sess_data["state"]["location"] is not None or sess_data["state"]["duration"] is not None

    # BUG 5: Corrections
    print("\n📍 Test Bug 5: Location Correction")
    session_correct = "test_correct"
    engine.start_new_session(session_correct, "user_correct")
    engine.process_user_response(session_correct, "pain in my right gums")
    resp_correct, _ = engine.process_user_response(session_correct, "actually it's the left side, not right")
    print(f"   Input: 'actually it's the left side, not right'")
    print(f"   AI Response: {resp_correct}")
    sess_data = engine.engine.sessions[session_correct]
    print(f"   Updated Location: {sess_data['state']['location']}")
    assert "left" in sess_data["state"]["location"]
    assert "updating" in resp_correct or "left" in resp_correct

    # BUG 5: Direct Questions
    print("\n📍 Test Bug 5: Direct Questions")
    session_q = "test_q"
    engine.start_new_session(session_q, "user_q")
    resp_q, _ = engine.process_user_response(session_q, "is this serious?")
    print(f"   Input: 'is this serious?'")
    print(f"   AI Response: {resp_q}")
    assert "definitive" in resp_q or "assistant" in resp_q

    # BUG 5: Tamil support
    print("\n📍 Test Bug 5: Tamil Support")
    session_tamil = "test_tamil"
    engine.start_new_session(session_tamil, "user_tamil")
    resp_tamil, _ = engine.process_user_response(session_tamil, "வணக்கம்")
    print(f"   Input: 'வணக்கம்'")
    print(f"   AI Response: {resp_tamil}")
    assert any(c in resp_tamil for c in ["வணக்கம்", "ஈறு", "பல்", "பிரச்சனை"])

    # BUG 6: Gibberish ("yy", "hgsf", "jhd") then ONE real symptom message
    print("\n📍 Test Bug 6: Gibberish then one real symptom does not trigger assessment")
    session_bug6 = "test_bug6"
    engine.start_new_session(session_bug6, "user_bug6")
    engine.process_user_response(session_bug6, "yy")
    engine.process_user_response(session_bug6, "hgsf")
    engine.process_user_response(session_bug6, "jhd")
    resp_bug6, is_complete = engine.process_user_response(session_bug6, "gums bleed when i brush my teeth")
    print(f"   Input sequence: 'yy' -> 'hgsf' -> 'jhd' -> 'gums bleed when i brush my teeth'")
    print(f"   AI Response: {resp_bug6}")
    print(f"   Is assessment complete: {is_complete}")
    assert not is_complete, "ERROR: Assessment triggered after only one real message!"

    print("\n✅ All bug verification tests passed successfully!")


if __name__ == "__main__":
    # Run the main conversation test
    test_ai_conversation()

    # Test different severity levels
    test_different_severity_levels()

    # Test specific bug fixes
    test_clinical_chat_bugs()

    print("\n✨ All tests completed! Your backend is ready to go.\n")
