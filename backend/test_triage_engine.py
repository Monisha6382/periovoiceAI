import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.triage_state_engine import triage_state_engine

def run_tests():
    print("🧪 Testing PerioVoice AI Adaptive Triage State Engine...\n")

    # Test 1: Start Session
    session_id, greeting, first_q = triage_state_engine.start_session("test_user_1")
    print(f"✓ Session Started: {session_id[:8]}...")
    print(f"  Greeting: {greeting[:60]}...")
    print(f"  First Question: {first_q}\n")

    # Test 2: Off-Topic Query Guardrail
    res_off = triage_state_engine.process_chat_message(session_id, "Which AI is better, ChatGPT or Claude?")
    print("✓ Off-Topic Test:")
    print(f"  User: Which AI is better, ChatGPT or Claude?")
    print(f"  Bot: {res_off['response']}\n")
    assert "specifically built to help with dental" in res_off["response"]

    # Test 3: Adaptive Turn 1 (Location + Pain level)
    res_turn1 = triage_state_engine.process_chat_message(session_id, "I have severe upper right gum pain rated 8 out of 10")
    print("✓ Adaptive Turn 1 (Location & Pain given):")
    print(f"  Bot: {res_turn1['response']}\n")
    state = triage_state_engine.sessions[session_id]["state"]
    assert state["location"] == "upper right gum"
    assert state["pain_level"] == 8
    # Should ask for duration next (never repeats location/pain!)
    assert "how long" in res_turn1["response"].lower()

    # Test 4: Adaptive Turn 2 (Duration given)
    res_turn2 = triage_state_engine.process_chat_message(session_id, "It started about 3 days ago")
    print("✓ Adaptive Turn 2 (Duration given):")
    print(f"  Bot: {res_turn2['response']}\n")
    state = triage_state_engine.sessions[session_id]["state"]
    assert "3 days" in state["duration"]
    # Should ask for frequency, swelling or bleeding next
    assert "every time" in res_turn2["response"].lower() or "frequency" in res_turn2["response"].lower() or "swelling" in res_turn2["response"].lower() or "bleeding" in res_turn2["response"].lower()

    # Test 5: Adaptive Turn 3 (Swelling & Emergency evaluation)
    res_turn3 = triage_state_engine.process_chat_message(session_id, "Yes, my cheek is severely swollen and I have a high fever")
    print("✓ Adaptive Turn 3 (Emergency Symptoms given):")
    print(f"  Is Assessment Complete: {res_turn3['is_assessment_complete']}")
    print(f"  Final Urgency: {res_turn3['final_result']['urgency']}")
    print(f"  Rationale: {res_turn3['final_result']['urgency_rationale']}\n")
    assert res_turn3["is_assessment_complete"] == True
    assert res_turn3["final_result"]["urgency"] in ["HIGH", "EMERGENCY"]

    # Test 6: Validation Table Case - "i have leg pain"
    session_id2, _, _ = triage_state_engine.start_session("test_user_2")
    res_leg = triage_state_engine.process_chat_message(session_id2, "i have leg pain")
    print("✓ Test 6 (Leg pain redirect):")
    print(f"  Bot: {res_leg['response']}")
    assert "leg pain" in res_leg["response"]
    assert "specifically built" in res_leg["response"]

    # Test 7: Validation Table Case - "nothing"
    res_nothing = triage_state_engine.process_chat_message(session_id2, "nothing")
    print("✓ Test 7 (Nothing response):")
    print(f"  Bot: {res_nothing['response']}")
    assert "No worries" in res_nothing["response"]

    # Test 8: Validation Table Case - "dd" then "ff" repeated
    session_id3, _, _ = triage_state_engine.start_session("test_user_3")
    res_dd = triage_state_engine.process_chat_message(session_id3, "dd")
    res_ff = triage_state_engine.process_chat_message(session_id3, "ff")
    res_ff2 = triage_state_engine.process_chat_message(session_id3, "ff")
    print("✓ Test 8 (dd then ff repeated doesn't trigger assessment):")
    assert not res_dd["is_assessment_complete"]
    assert not res_ff["is_assessment_complete"]
    assert not res_ff2["is_assessment_complete"]

    # Test 9: Validation Table Case - Location match short answer
    session_id4, _, _ = triage_state_engine.start_session("test_user_4")
    # First message: symptom (no location info)
    res_sym = triage_state_engine.process_chat_message(session_id4, "bleeding when i brush")
    # Location should be asked next
    assert triage_state_engine.sessions[session_id4]["last_asked"] == "location"
    res_loc = triage_state_engine.process_chat_message(session_id4, "up")
    print("✓ Test 9 (Location short answer 'up' matched as 'upper'):")
    assert triage_state_engine.sessions[session_id4]["state"]["location"] == "upper"

    # Test 10: Validation Table Case - Duration numeric input
    session_id5, _, _ = triage_state_engine.start_session("test_user_5")
    # Set symptom to bleeding (no location info)
    triage_state_engine.process_chat_message(session_id5, "bleeding")
    # Ask location
    triage_state_engine.process_chat_message(session_id5, "upper")
    # Now it should ask duration
    assert triage_state_engine.sessions[session_id5]["last_asked"] == "duration"
    # Send numeric input
    triage_state_engine.process_chat_message(session_id5, "5")
    print("✓ Test 10 (Numeric input '5' for duration interpreted as '5 days'):")
    assert triage_state_engine.sessions[session_id5]["state"]["duration"] == "5 days"
    assert triage_state_engine.sessions[session_id5]["state"]["pain_level"] is None

    # Test 11: Validation Table Case - Pain level numeric input
    session_id6, _, _ = triage_state_engine.start_session("test_user_6")
    # Set symptom to toothache (no bleeding/swelling)
    triage_state_engine.process_chat_message(session_id6, "toothache")
    # Mock details to trigger pain_level question next
    triage_state_engine.sessions[session_id6]["state"]["location"] = "upper"
    triage_state_engine.sessions[session_id6]["state"]["duration"] = "3 days"
    triage_state_engine.sessions[session_id6]["details"]["duration"] = "3 days"
    triage_state_engine.sessions[session_id6]["details"]["frequency"] = "sometimes"
    # Force last asked to be frequency so we can advance
    triage_state_engine.sessions[session_id6]["last_asked"] = "frequency"
    # Process message to update and select next question
    triage_state_engine.process_chat_message(session_id6, "sometimes")
    # Now it should ask pain level
    assert triage_state_engine.sessions[session_id6]["last_asked"] == "pain_level"
    # Send numeric input
    triage_state_engine.process_chat_message(session_id6, "5")
    print("✓ Test 11 (Numeric input '5' for pain level interpreted as 5):")
    assert triage_state_engine.sessions[session_id6]["state"]["pain_level"] == 5

    print("🎉 ALL ADAPTIVE TRIAGE STATE ENGINE TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_tests()
