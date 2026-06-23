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


if __name__ == "__main__":
    # Run the main conversation test
    test_ai_conversation()

    # Test different severity levels
    test_different_severity_levels()

    print("\n✨ All tests completed! Your backend is ready to go.\n")
