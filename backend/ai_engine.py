"""
AI Engine for PerioVoice AI.
Handles conversational flow, symptom collection, and urgency assessment.
"""

import json
import copy
import os
from dotenv import load_dotenv
from fastapi import responses
from groq import Groq

load_dotenv("backend/.env")

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

from datetime import datetime
from typing import Dict, List, Tuple
from backend.models import UrgencyLevel


class PeriovoiceAIEngine:
    """
    The core AI engine that conducts the conversation with the user.
    It asks questions one by one, collects symptoms, and determines urgency.
    """
    def get_llm_response(self, user_message: str, session_data: dict = None):
        try:
            conversation = ""
            possible_questions = [
                 "How long have you had these symptoms?",
                 "What is your pain level from 1 to 10?",
                 "Do you notice swelling or pus?",
                 "Do you have loose teeth?",
                 "Do your gums bleed while brushing?",
                 "When was your last dental visit?"
                 ]
            
            remaining_questions = possible_questions.copy()
            asked_questions = []

            if session_data:
                for msg in session_data.get("conversation", [])[-6:]:
                    role = "User" if msg.get("isUser") else "AI"
                    conversation += f"{role}: {msg.get('text', '')}\n"
                    asked_questions = session_data.get("asked_questions", [])
                    remaining_questions = [
    q for q in possible_questions if q not in asked_questions
]

            prompt = f"""
You are PerioVoice AI™, an intelligent and friendly dental assistant specializing in gum and periodontal health.

Your personality:

* Speak naturally and professionally.
* Be warm, supportive, and easy to understand.
* Do not sound robotic.
* Respond like a real healthcare assistant.
* Keep responses concise but informative.

Conversation rules:

* Understand context and remember previous messages.
* Do NOT repeat questions that were already answered.
* Ask only ONE follow-up question at a time.
* If the user provides multiple details in one message, use them and avoid asking again.
* If enough information is available, stop asking questions and provide an assessment.

Image handling:

* If the user says they will upload an image, wait for the image instead of asking more questions.
* Respond with something like:
  "Sure, please upload a clear image of your gums or teeth. I'll analyze it and continue the assessment."
* After image analysis, combine image findings with reported symptoms.

Handling unclear input:

* If the message is unrelated, random numbers, symbols, or unclear text, politely ask the user to describe their symptoms.
* Never crash or show technical errors.

Assessment goals:
Collect information about:

* Duration of symptoms
* Pain level (1-10)
* Bleeding gums
* Swelling or redness
* Pus or bad taste
* Loose teeth
* Last dental visit

Assessment output:
When enough information is available, provide:

Assessment Summary

Possible Condition:
[Likely condition]

Risk Score:
[X]/10

Urgency Level:
Low / Moderate / High / Emergency

Reason:
Brief explanation based on symptoms.

Recommendation:
What the user should do next.

Important:

* Do not claim to provide a medical diagnosis.
* Clearly state that the assessment is informational only.
* Recommend a dentist visit when appropriate.

Previous conversation:
{conversation}

Latest user message:
{user_message}

Available next questions:
{remaining_questions}

Reply naturally as a professional dental assistant.
"""


            
            response = client.chat.completions.create(
                 model="llama-3.3-70b-versatile",
                 messages=[
        {"role": "system", "content": "You are PerioVoice AI, a helpful dental symptom assessment chatbot. Ask one short follow-up question at a time. Do not diagnose."},
        {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=250,
        )
            ai_text = response.choices[0].message.content

            for q in possible_questions:
                 if q in ai_text:
                      asked_questions.append(q)
                      
                      if session_data:
                           session_data["asked_questions"] = asked_questions
                           
                      return ai_text
            return ai_text

        except Exception as e:
            return f"AI error: {str(e)}"
        
    def __init__(self):
        # Define the flow of questions the AI should ask
        self.questions = [
            "How long have you had the gum problem?",
            "What is your pain level from 1 to 10?",
            "Do you notice swelling, pus, or bad taste?",
            "Do you have loose teeth?",
            "When was your last dental visit?",
        ]

        # Initialize sessions storage (in production, this would be in database)
        self.sessions: Dict[str, dict] = {}

    def start_new_session(self, session_id: str, user_id: str) -> Tuple[str, str]:
        """
        Start a new assessment session.
        Returns: (greeting_message, first_question)
        """
        self.sessions[session_id] = {
            "user_id": user_id,
            "conversation": [],
            "question_index": 0,
            "symptoms": [],
            "responses": {},
            "image_description": None,
        }

        greeting = (
            "Hello! 👋 I'm your PerioVoice AI dental assistant. "
            "I'm here to help assess your gum and tooth symptoms and recommend the right level of care. "
            "Let's start with a few questions about what you're experiencing. "
            "Please be as detailed as possible!"
        )

        return greeting, self.get_next_question(session_id)

    def get_next_question(self, session_id: str) -> str:
        """
        Get the next question to ask the user.
        """
        if session_id not in self.sessions:
            return "Error: Session not found."

        session = self.sessions[session_id]
        q_index = session["question_index"]

        if q_index < len(self.questions):
            return self.questions[q_index]
        else:
            return ""

    def process_user_response(self, session_id: str, user_message: str) -> Tuple[str, bool]:
        """
        Process the user's response and return the next message.
        Returns: (ai_response, is_assessment_complete)
        """
        if session_id not in self.sessions:
            return "Error: Session not found.", False

        session = self.sessions[session_id]
        q_index = session["question_index"]

        # Store the user's response
        question_key = f"question_{q_index}"
        session["responses"][question_key] = user_message

        # Extract symptoms from the response (simple keyword matching)
        self._extract_symptoms(session, user_message, q_index)

        # Move to next question
        session["question_index"] += 1

        # Check if we've asked all questions
        if session["question_index"] >= len(self.questions):
            assessment_complete = True
            ai_response = (
                "Thank you for providing all that information! 🔍\n\n"
                "I'm now analyzing your symptoms to assess the urgency level..."
            )
            return ai_response, assessment_complete
        else:
            next_q = self.get_next_question(session_id)
            ai_response = next_q
            return ai_response, False

    def _process_user_response_state(self, session: dict, user_message: str) -> Tuple[str, bool]:
        """Process a user message against a copied session state without mutating the live session."""
        q_index = session["question_index"]
        question_key = f"question_{q_index}"
        session["responses"][question_key] = user_message
        self._extract_symptoms(session, user_message, q_index)
        session["question_index"] += 1

        if session["question_index"] >= len(self.questions):
            ai_response = (
                "Thank you for providing all that information! 🔍\n\n"
                "I'm now analyzing your symptoms to assess the urgency level..."
            )
            return ai_response, True

        next_q = self.questions[session["question_index"]]
        ai_response = f"Got it, thank you for sharing that.\n\n{next_q}"
        return ai_response, False

    def _get_next_question_for_state(self, session: dict) -> str:
        if session["question_index"] < len(self.questions):
            return f"**Question {session['question_index'] + 1}/{len(self.questions)}:** {self.questions[session['question_index']]}"
        return ""

    def simulate_response(self, session_id: str, user_message: str) -> Tuple[str, bool, str, dict]:
        """Simulate a rule-based response using a copy of the current session state."""
        if session_id not in self.sessions:
            return "Error: Session not found.", False, "", {}

        session_copy = copy.deepcopy(self.sessions[session_id])
        session_copy.setdefault("conversation", []).append(
            {
                "isUser": True,
                "text": user_message,
                "timestamp": datetime.now().isoformat(),
            }
        )
        ai_response, is_complete = self._process_user_response_state(session_copy, user_message)

        if is_complete:
            urgency, risk_score, symptoms, _ = self.calculate_urgency_for_state(session_copy)
            recommendation, home_care_tips, should_see_dentist = self.generate_recommendation(
                urgency, risk_score, symptoms
            )
            final_result = {
                "urgency_level": urgency,
                "risk_score": risk_score,
                "symptoms_found": symptoms,
                "recommendation": recommendation,
                "home_care_tips": home_care_tips,
                "should_see_dentist": should_see_dentist,
            }
        else:
            final_result = None

        next_question = self._get_next_question_for_state(session_copy)
        return ai_response, is_complete, next_question, final_result

    def _extract_symptoms(self, session: dict, message: str, question_index: int) -> None:
        """
        Extract symptoms from user's response using keyword matching.
        This is a simplified version - in production, could use NLP.
        """
        message_lower = message.lower()

        # Map question index to symptom keywords
        symptom_keywords = {
            0: {  # Question about location
                "bleeding": ["bleeding", "bleed"],
                "swelling": ["swelling", "swollen", "swallow"],
                "pain": ["pain", "hurt", "ache", "sore"],
            },
            1: {  # Question about duration
                "chronic": ["month", "year", "long time"],
                "acute": ["day", "few day", "yesterday", "today"],
            },
            2: {  # Question about severity
                "severe": ["8", "9", "10", "very severe"],
                "moderate": ["5", "6", "7"],
                "mild": ["1", "2", "3", "4"],
            },
            3: {  # Question about bleeding
                "gum_bleeding": ["yes", "bleed", "blood", "true"],
            },
            4: {  # Question about swelling/pus/taste
                "swelling": ["swelling", "swollen"],
                "pus": ["pus", "discharge"],
                "bad_taste": ["taste", "foul", "bad"],
            },
            5: {  # Question about loose teeth
                "loose_teeth": ["loose", "wobbly", "move", "shifting"],
            },
            6: {  # Question about last dental visit
                "no_recent_visit": ["month", "year", "never", "long time"],
            },
        }

        # Extract symptoms for this question
        if question_index in symptom_keywords:
            for symptom, keywords in symptom_keywords[question_index].items():
                for keyword in keywords:
                    if keyword in message_lower:
                        if symptom not in session["symptoms"]:
                            session["symptoms"].append(symptom)

    def add_image_description(self, session_id: str, description: str) -> None:
        """
        Add image analysis description to the session.
        """
        if session_id in self.sessions:
            self.sessions[session_id]["image_description"] = description

    def calculate_urgency(self, session_id: str) -> Tuple[UrgencyLevel, int, List[str], str]:
        """
        Calculate the urgency level and risk score based on collected symptoms.
        Returns: (urgency_level, risk_score, symptoms_list, detailed_explanation)
        """
        if session_id not in self.sessions:
            return UrgencyLevel.LOW, 1, [], "Session not found"

        session = self.sessions[session_id]
        symptoms = session["symptoms"]
        responses = session["responses"]

        risk_score = 1
        urgency = UrgencyLevel.LOW
        explanation = ""

        # ========== SCORING LOGIC ==========
        # Add points for each symptom/response combination

        # Check for severe pain (question 2)
        if "question_1" in responses:
            try:
                pain = int(''.join(filter(str.isdigit, responses["question_1"])))
                if pain >= 9:
                    risk_score += 5
                elif pain >= 7:
                    risk_score += 4
                elif pain >= 5:
                    risk_score += 2
            except:
                pass

        # Bleeding gums (HIGH risk)
        if "gum_bleeding" in symptoms or "bleeding" in symptoms:
            risk_score += 3

        # Swelling/pus/bad taste (HIGH risk)
        if "swelling" in symptoms or "pus" in symptoms or "bad_taste" in symptoms:
            risk_score += 3

        # Loose teeth (VERY HIGH risk)
        if "loose_teeth" in symptoms:
            risk_score += 4

        # Chronic duration (ongoing issue = higher risk)
        if "question_1" in responses:
            duration = responses["question_1"].lower()
            if any(x in duration for x in ["month", "year"]):
                risk_score += 2

        # No recent dental visit
        if "question_6" in responses:
            visit = responses["question_6"].lower()
            if any(x in visit for x in ["month", "year", "never"]):
                risk_score += 1

        # Cap the risk score at 10
        risk_score = min(risk_score, 10)

        # ========== DETERMINE URGENCY ==========
        if risk_score >= 9:
            urgency = UrgencyLevel.EMERGENCY
            explanation = "Multiple severe symptoms detected. Requires immediate dental attention."
        elif risk_score >= 7:
            urgency = UrgencyLevel.HIGH
            explanation = "Significant symptoms indicating advanced periodontal issues."
        elif risk_score >= 4:
            urgency = UrgencyLevel.MODERATE
            explanation = "Moderate symptoms suggesting early periodontal disease."
        else:
            urgency = UrgencyLevel.LOW
            explanation = "Minor symptoms that can be managed with home care."

        return urgency, risk_score, symptoms, explanation

    def calculate_urgency_for_state(self, session: dict) -> Tuple[UrgencyLevel, int, List[str], str]:
        """Calculate urgency from a copied session state without mutating live sessions."""
        symptoms = session.get("symptoms", [])
        responses = session.get("responses", {})

        risk_score = 1
        urgency = UrgencyLevel.LOW
        explanation = ""

        if "question_1" in responses:
            try:
                pain = int(''.join(filter(str.isdigit, responses["question_1"])))
                if pain >= 9:
                    risk_score += 5
                elif pain >= 7:
                    risk_score += 4
                elif pain >= 5:
                    risk_score += 2
            except:
                pass
            
        if "gum_bleeding" in symptoms or "bleeding" in symptoms:
            risk_score += 3

        if "swelling" in symptoms or "pus" in symptoms or "bad_taste" in symptoms:
            risk_score += 3

        if "loose_teeth" in symptoms:
            risk_score += 4

        if "question_1" in responses:
            duration = responses["question_1"].lower()
            if any(x in duration for x in ["month", "year"]):
                risk_score += 2

        if "question_6" in responses:
            visit = responses["question_6"].lower()
            if any(x in visit for x in ["month", "year", "never"]):
                risk_score += 1

        risk_score = min(risk_score, 10)

        if risk_score >= 9:
            urgency = UrgencyLevel.EMERGENCY
            explanation = "Multiple severe symptoms detected. Requires immediate dental attention."
        elif risk_score >= 7:
            urgency = UrgencyLevel.HIGH
            explanation = "Significant symptoms indicating advanced periodontal issues."
        elif risk_score >= 4:
            urgency = UrgencyLevel.MODERATE
            explanation = "Moderate symptoms suggesting early periodontal disease."
        else:
            urgency = UrgencyLevel.LOW
            explanation = "Minor symptoms that can be managed with home care."

        return urgency, risk_score, symptoms, explanation

    def generate_recommendation(
        self, urgency: UrgencyLevel, risk_score: int, symptoms: List[str]
    ) -> Tuple[str, List[str], bool]:
        """
        Generate final recommendation based on urgency level.
        Returns: (recommendation_text, home_care_tips, should_see_dentist)
        """

        home_care_tips = [
            "Brush your teeth twice daily with a soft-bristled toothbrush",
            "Floss daily to remove plaque between teeth",
            "Use an antimicrobial mouthwash as recommended",
            "Avoid smoking and tobacco products",
            "Maintain a healthy diet low in sugar",
        ]

        should_see_dentist = True

        if urgency == UrgencyLevel.EMERGENCY:
            recommendation = (
                "🚨 **EMERGENCY** - This requires immediate attention!\n"
                "Please visit your dentist or emergency dental clinic TODAY or go to the nearest ER.\n"
                "Do not delay - severe periodontal disease can lead to tooth loss and other health complications."
            )
            home_care_tips.insert(0, "Rinse with warm salt water 3-4 times daily to reduce inflammation")

        elif urgency == UrgencyLevel.HIGH:
            recommendation = (
                "🔴 **HIGH URGENCY** - See a dentist within the next 48 hours.\n"
                "Your symptoms suggest advanced gum disease that needs professional treatment.\n"
                "Don't wait - early professional intervention can prevent further deterioration."
            )
            home_care_tips.insert(0, "Start gentle brushing and flossing without causing more irritation")

        elif urgency == UrgencyLevel.MODERATE:
            recommendation = (
                "🟡 **MODERATE** - Schedule a dental appointment within 1-2 weeks.\n"
                "You likely have early signs of gum disease (gingivitis).\n"
                "Professional cleaning and proper home care can prevent progression to periodontitis."
            )

        elif urgency == UrgencyLevel.LOW:
            recommendation = (
                "🟢 **LOW RISK** - Your symptoms are mild.\n"
                "Continue with good oral hygiene at home and schedule a regular dental checkup within the next month.\n"
                "Most cases at this stage respond well to home care and preventive measures."
            )
            should_see_dentist = False

        return recommendation, home_care_tips, should_see_dentist

    def get_session_data(self, session_id: str) -> dict:
        """
        Retrieve all data from a session.
        Useful for saving to database.
        """
        if session_id not in self.sessions:
            return {}
        return self.sessions[session_id]

    def end_session(self, session_id: str) -> None:
        """
        End a session (cleanup).
        """
        if session_id in self.sessions:
            del self.sessions[session_id]