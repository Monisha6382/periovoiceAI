"""
rule_engine.py — PerioVoice AI™ Core Wrapper
Exposes rule_engine delegating to triage_state_engine.
"""

from backend.triage_state_engine import triage_state_engine, TriageStateEngine

class RuleEngineWrapper:
    def __init__(self):
        self.engine = triage_state_engine
        self.sessions = self.engine.sessions

    def start_session(self, user_id: str):
        return self.engine.start_session(user_id)

    def process_chat_message(self, session_id: str, user_message: str):
        return self.engine.process_chat_message(session_id, user_message)

    def calculate_triage(self, matched_symptoms: dict):
        return self.engine.generate_final_assessment({}, set(matched_symptoms.keys()))

rule_engine = RuleEngineWrapper()
