"""
ai_engine.py — PerioVoice AI™ Compatibility Wrapper
Delegates all session management and triage processing to rule_engine.py.
Groq and external LLM dependencies have been completely removed.
"""

from backend.rule_engine import rule_engine

class PeriovoiceAIEngine:
    """
    Wrapper providing backwards compatibility for existing imports of PeriovoiceAIEngine.
    Directly interfaces with the deterministic RuleEngine.
    """
    def __init__(self):
        self.engine = rule_engine
        self.sessions = self.engine.sessions

    def start_new_session(self, session_id: str, user_id: str):
        greeting = (
            "Hello! 👋 I am PerioVoice AI™, your periodontal health triage assistant. "
            "I'm here to help assess your gum and tooth symptoms and recommend the right level of care."
        )
        first_q = "What primary symptoms are you experiencing with your teeth or gums?"
        
        self.engine.sessions[session_id] = {
            "user_id": user_id,
            "turn_count": 0,
            "state": {
                "location": None,
                "duration": None,
                "pain_level": None,
                "bleeding": None,
                "swelling": None,
                "pus": None,
                "sensitivity": None,
                "fever": None,
                "trauma": None
            },
            "matched_symptom_keys": set(),
            "matched_symptoms": {},
            "asked_categories": set(),
            "transcript": [{"sender": "bot", "text": greeting + " " + first_q}],
            "completed": False,
            "question_index": 0,
            "responses": {},
            "symptoms": []
        }
        return greeting, first_q

    def process_user_response(self, session_id: str, user_message: str):
        res = self.engine.process_chat_message(session_id, user_message)
        return res["response"], res["is_assessment_complete"]

    def get_next_question(self, session_id: str) -> str:
        session = self.engine.sessions.get(session_id, {})
        state = session.get("state", {})
        from backend.triage_state_engine import triage_state_engine
        q_field, next_q = triage_state_engine.get_next_adaptive_question(state)
        return next_q

    def calculate_urgency(self, session_id: str):
        session = self.engine.sessions.get(session_id, {})
        matched_keys = session.get("matched_symptom_keys", set())
        state = session.get("state", {})
        from backend.triage_state_engine import triage_state_engine
        triage = triage_state_engine.generate_final_assessment(state, matched_keys)
        
        from backend.models import UrgencyLevel
        return UrgencyLevel(triage["urgency"]), triage["risk_score"], triage["symptoms"], triage["urgency_rationale"]

    def generate_recommendation(self, urgency: str, risk_score: int, symptoms: list):
        state = {
            "location": "Oral Cavity",
            "duration": "Not specified",
            "pain_level": risk_score,
            "bleeding": True if "bleeding" in str(symptoms).lower() else None,
            "swelling": True if "swelling" in str(symptoms).lower() else None,
            "pus": True if "pus" in str(symptoms).lower() else None,
            "sensitivity": None,
            "fever": True if "fever" in str(symptoms).lower() else None,
            "trauma": True if "trauma" in str(symptoms).lower() or "knocked" in str(symptoms).lower() else None
        }
        from backend.triage_state_engine import triage_state_engine, DENTAL_DB
        symptoms_db = DENTAL_DB.get("symptoms", {})
        symptom_keys = set()
        for sym_name in symptoms:
            found = False
            for k, v in symptoms_db.items():
                if v.get("display_name") == sym_name:
                    symptom_keys.add(k)
                    found = True
                    break
            if not found:
                symptom_keys.add(sym_name.lower().replace(" ", "_"))
                
        triage = triage_state_engine.generate_final_assessment(state, symptom_keys)
        return triage["recommendation"], triage["home_care_tips"], triage["should_see_dentist"]

    def get_session_data(self, session_id: str) -> dict:
        return self.engine.sessions.get(session_id, {})

    def end_session(self, session_id: str):
        if session_id in self.engine.sessions:
            del self.engine.sessions[session_id]