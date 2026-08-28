"""
triage_state_engine.py — PerioVoice AI™ Adaptive Triage Engine
Dynamic state-machine tracking symptom entities, conversation memory, off-topic detection,
and adaptive follow-up question selection.
"""

import json
import os
import re
import uuid
import csv
import random
from typing import Dict, List, Tuple, Optional
from rapidfuzz import fuzz, process
from backend import llm_client

# Load knowledge database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "dental_knowledge_db.json")

def load_db() -> dict:
    if os.path.exists(DB_PATH):
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

DENTAL_DB = load_db()

# Load the massive symptom dataset for fuzzy matching & disease prediction
MASSIVE_CSV_PATH = os.path.join(BASE_DIR, "periovoice_dental_symptom_dataset_massive.csv")
CSV_PATH = MASSIVE_CSV_PATH if os.path.exists(MASSIVE_CSV_PATH) else os.path.join(BASE_DIR, "periovoice_dental_symptom_dataset_large.csv")
DATASET_ROWS = []

def load_dataset():
    global DATASET_ROWS
    if os.path.exists(CSV_PATH):
        try:
            with open(CSV_PATH, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                DATASET_ROWS = list(reader)
            print(f"📊 Loaded {len(DATASET_ROWS):,} clinical symptom records from {os.path.basename(CSV_PATH)} for AI disease & urgency prediction!")
        except Exception as e:
            print(f"⚠️ Error loading symptom dataset CSV: {e}")
    else:
        print("⚠️ Symptom dataset CSV not found")

load_dataset()

OFF_TOPIC_KEYWORDS = [
    "chatgpt", "claude", "gemini", "llama", "python", "javascript", "code",
    "weather", "capital of", "who is the president", "movie", "football",
    "cricket", "recipe", "math problem", "solve"
]

RESPONSE_TEMPLATES = {
    "greeting": [
        "Hello! 👋 Welcome to PerioVoice AI. I'm here to help you understand your dental symptoms. Could you describe what's been bothering you with your teeth or gums?",
        "Hi there! 👋 I'm your PerioVoice dental health assistant. Please tell me about any tooth or gum discomfort you've been experiencing.",
        "Welcome! 😊 I'm PerioVoice AI, and I'll help assess your dental symptoms. What's been troubling you?"
    ],
    "ack_location": [
        "I understand — discomfort in the {location} is noted.",
        "Thank you for that detail. Pain around the {location} is something we should look into carefully.",
        "Got it, the {location} area. That's helpful to know."
    ],
    "ack_duration": [
        "Noted — symptoms present for {duration} gives me a better picture.",
        "Thank you. Having this for {duration} is important clinical context.",
        "I appreciate you sharing that. Knowing it has been going on for {duration} helps."
    ],
    "ack_pain": [
        "A pain level of {pain}/10 is significant, and I am sorry you are experiencing that.",
        "Thank you for rating that. {pain} out of 10 helps me understand the intensity of your discomfort.",
        "I hear you — {pain}/10 pain is important to record."
    ],
    "ack_swelling": [
        "{swelling_ack}",
        "Noted. {swelling_ack}",
        "Thank you. {swelling_ack}"
    ],
    "ack_bleeding": [
        "{bleeding_ack}",
        "Noted. {bleeding_ack}",
        "Thank you. {bleeding_ack}"
    ],
    "ack_pus": [
        "{pus_ack}",
        "Noted. {pus_ack}",
        "Thank you. {pus_ack}"
    ],
    "swelling_yes": "I see — swelling is definitely something to monitor closely.",
    "swelling_no": "Good to know there's no visible swelling — that's a positive sign.",
    "bleeding_yes": "I understand — gum bleeding is a common but important symptom to track.",
    "bleeding_no": "Reassuring that there's no bleeding.",
    "pus_yes": "The presence of discharge is clinically significant and should be evaluated.",
    "pus_no": "No discharge is a good sign.",
    "fallback_ack": [
        "Thank you for sharing that.",
        "I appreciate that information.",
        "Noted — thank you."
    ]
}

class TriageStateEngine:
    def __init__(self):
        self.sessions: Dict[str, dict] = {}

    def start_session(self, user_id: str) -> Tuple[str, str, str]:
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
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
            "transcript": [],
            "completed": False
        }

        greeting = (
            "🦷 PerioVoice AI: Hi! Tell me what’s bothering you about your teeth or gums today. You can describe it in your own words."
        )
        first_question = ""
        
        self.sessions[session_id]["transcript"].append({"sender": "bot", "text": greeting})
        return session_id, greeting, first_question

    def is_off_topic(self, text: str) -> bool:
        cleaned = text.lower()
        # Direct AI comparison or non-medical query check
        for kw in OFF_TOPIC_KEYWORDS:
            if kw in cleaned:
                # Unless it's asking a genuine dental symptom containing words
                if not any(d in cleaned for d in ["teeth", "tooth", "gum", "dentist", "mouth", "molar"]):
                    return True
        return False

    def fuzzy_match_dataset(self, user_text: str) -> dict:
        """Match user input against the 6000-row CSV dataset using rapidfuzz.
        Returns extracted clinical data from the best matching row."""
        if not DATASET_ROWS:
            return {}
        
        # Get the symptom descriptions for matching
        descriptions = [row.get('symptom_description', '') for row in DATASET_ROWS]
        
        # Find best match
        result = process.extractOne(
            user_text.lower(),
            descriptions,
            scorer=fuzz.token_set_ratio,
            score_cutoff=55
        )
        
        if result:
            matched_text, score, idx = result
            matched_row = DATASET_ROWS[idx]
            return {
                'location': matched_row.get('location', ''),
                'duration': matched_row.get('duration', ''),
                'pain_level': matched_row.get('pain_level_0_10', ''),
                'fever': matched_row.get('fever_present', ''),
                'swelling': matched_row.get('facial_swelling', ''),
                'bleeding': matched_row.get('bleeding', ''),
                'urgency_hint': matched_row.get('urgency_label', ''),
                'match_score': score
            }
        return {}

    def extract_entities(self, text: str, current_state: dict, last_asked: str = None) -> Tuple[dict, List[str], set]:
        cleaned = text.lower()
        extracted_symptom_keys = []
        explicit_fields = set()

        # Extract direct tags from system messages (image scanner tags)
        if cleaned.startswith("image scan shows"):
            for tag in ["mild_swelling", "bleeding_gums_brushing", "bad_breath_halitosis", "gum_bleeding", "swelling"]:
                if tag in cleaned:
                    extracted_symptom_keys.append(tag)

        # 1. Extract Pain Rating
        # Only extract raw number if it has context or last_asked was pain_level
        pain_context_match = re.search(r"\b([0-9]|10)\b\s*(?:out of 10|\/10|pain rating|pain level|pain score)", cleaned)
        if pain_context_match and current_state["pain_level"] is None:
            current_state["pain_level"] = int(pain_context_match.group(1))
            explicit_fields.add("pain_level")
        elif last_asked == "pain_level":
            pain_match = re.search(r"\b([0-9]|10)\b", cleaned)
            if pain_match and current_state["pain_level"] is None:
                current_state["pain_level"] = int(pain_match.group(1))
                explicit_fields.add("pain_level")

        if any(w in cleaned for w in ["severe pain", "unbearable", "excruciating", "throbbing"]):
            if current_state["pain_level"] is None:
                current_state["pain_level"] = 8
            extracted_symptom_keys.append("severe_throbbing_pain")
            explicit_fields.add("pain_level")
        elif any(w in cleaned for w in ["mild pain", "low pain"]):
            if current_state["pain_level"] is None:
                current_state["pain_level"] = 3
            extracted_symptom_keys.append("mild_pain")
            explicit_fields.add("pain_level")

        # 2. Extract Location
        locations_db = DENTAL_DB.get("locations", [])
        for loc in locations_db:
            if loc in cleaned and current_state["location"] is None:
                current_state["location"] = loc
                explicit_fields.add("location")
                break
        
        if current_state["location"] is None:
            if "molar" in cleaned or "back tooth" in cleaned:
                current_state["location"] = "back molar area"
                explicit_fields.add("location")
            elif "front tooth" in cleaned or "front teeth" in cleaned:
                current_state["location"] = "front teeth"
                explicit_fields.add("location")
            elif "cheek" in cleaned:
                current_state["location"] = "cheek / gum boundary"
                explicit_fields.add("location")
            elif "gum" in cleaned:
                current_state["location"] = "gum tissue"
                explicit_fields.add("location")

        # 3. Extract Duration
        duration_patterns = [
            (r"(\d+)\s*days?", "days"),
            (r"(\d+)\s*weeks?", "weeks"),
            (r"(\d+)\s*hours?", "hours"),
            (r"just started|overnight|today", "just started")
        ]
        for pat, unit in duration_patterns:
            m = re.search(pat, cleaned)
            if m and current_state["duration"] is None:
                current_state["duration"] = m.group(0)
                explicit_fields.add("duration")
                break

        # 4. Extract Bleeding
        if any(w in cleaned for w in ["bleed", "blood", "இரத்தம்"]):
            explicit_fields.add("bleeding")
            if re.search(r"\b(no|not|never|dont|without)\b.*\b(bleed|blood|bleeding)\b", cleaned) or cleaned in ["no", "none", "nothing", "இல்லை"]:
                current_state["bleeding"] = False
            else:
                current_state["bleeding"] = True
                if "spontaneous" in cleaned or "rest" in cleaned:
                    extracted_symptom_keys.append("spontaneous_bleeding")
                else:
                    extracted_symptom_keys.append("bleeding_gums")

        # 5. Extract Swelling
        if any(w in cleaned for w in ["swell", "swollen", "puffy", "வீக்கம்"]):
            explicit_fields.add("swelling")
            if re.search(r"\b(no|not|never|dont|without)\b.*\b(swell|swelling|swollen|puffy)\b", cleaned) or cleaned in ["no", "none", "nothing", "இல்லை"]:
                current_state["swelling"] = False
            else:
                current_state["swelling"] = True
                if any(w in cleaned for w in ["face", "cheek", "eye", "neck"]):
                    extracted_symptom_keys.append("severe_facial_swelling")
                else:
                    extracted_symptom_keys.append("mild_swelling")

        # 6. Extract Pus
        if any(w in cleaned for w in ["pus", "discharge", "exudate", "boil", "சீழ்"]):
            explicit_fields.add("pus")
            if re.search(r"\b(no|not|never|dont|without)\b.*\b(pus|discharge|exudate|boil)\b", cleaned) or cleaned in ["no", "none", "nothing", "இல்லை"]:
                current_state["pus"] = False
            else:
                current_state["pus"] = True
                extracted_symptom_keys.append("pus_discharge")

        # 7. Extract Fever
        if any(w in cleaned for w in ["fever", "chills", "high temp", "காய்ச்சல்"]):
            explicit_fields.add("fever")
            if re.search(r"\b(no|not|never|dont|without)\b.*\b(fever|chills|temp)\b", cleaned) or cleaned in ["no", "none", "nothing", "இல்லை"]:
                current_state["fever"] = False
            else:
                current_state["fever"] = True
                extracted_symptom_keys.append("fever")

        # 8. Extract Trauma
        if any(w in cleaned for w in ["knocked out", "avulsed", "fall", "accident", "trauma", "broken tooth"]):
            explicit_fields.add("trauma")
            if re.search(r"\b(no|not|never|dont|without)\b.*\b(knock|avuls|fall|accident|trauma|broken)\b", cleaned) or cleaned in ["no", "none", "nothing", "இல்லை"]:
                current_state["trauma"] = False
            else:
                current_state["trauma"] = True
                extracted_symptom_keys.append("tooth_knocked_out")

        # 9. Extract Sensitivity
        if "cold" in cleaned:
            current_state["sensitivity"] = "cold"
            extracted_symptom_keys.append("cold_sensitivity")
            explicit_fields.add("sensitivity")
        elif "hot" in cleaned:
            current_state["sensitivity"] = "hot"
            extracted_symptom_keys.append("hot_sensitivity")
            explicit_fields.add("sensitivity")

        # After regex matching, use fuzzy matching fallback to fill empty fields (strictly >= 85 score)
        if len(cleaned.split()) >= 3 and len(cleaned) >= 8:
            if any(v is None for k, v in current_state.items() if k in ['location', 'duration', 'pain_level']):
                fuzzy_data = self.fuzzy_match_dataset(cleaned)
                if fuzzy_data.get('match_score', 0) >= 85:
                    if current_state['location'] is None and fuzzy_data.get('location'):
                        current_state['location'] = fuzzy_data['location']
                    if current_state['duration'] is None and fuzzy_data.get('duration'):
                        current_state['duration'] = fuzzy_data['duration']
                    if current_state['pain_level'] is None and fuzzy_data.get('pain_level'):
                        try:
                            current_state['pain_level'] = int(fuzzy_data['pain_level'])
                        except (ValueError, TypeError):
                            pass

        return current_state, list(set(extracted_symptom_keys)), explicit_fields

    def is_tamil(self, text: str) -> bool:
        # Detect Tamil Unicode range \u0b80-\u0bff
        return any('\u0b80' <= char <= '\u0bff' for char in text)

    def get_next_adaptive_question(self, state: dict) -> Optional[Tuple[str, str]]:
        """Compatibility wrapper for older code calling this method."""
        res = self.select_next_question(state, {}, [])
        if res:
            q_field, next_q, q_desc = res
            return q_field, next_q
        return None

    def select_next_question(self, state: dict, details: dict, asked_fields: list = None, symptom_keys: set = None) -> Optional[Tuple[str, str, str]]:
        """
        Adaptive Clinical Question Selection based on 51 PerioVoice AI Directives:
        - NEVER use fixed question sequences.
        - Immediately prioritize RED FLAGS & safety if swelling is present.
        - Ask ONLY ONE relevant, symptom-specific next question.
        """
        if asked_fields is None:
            asked_fields = []
        if symptom_keys is None:
            symptom_keys = set()

        # 1. SAFETY & RED FLAG CHECK (Highest Priority)
        if (state.get("swelling") or "severe_facial_swelling" in symptom_keys) and "airway_red_flag" not in asked_fields:
            return "airway_red_flag", "Since swelling is present, I want to check for safety: are you experiencing any difficulty breathing or difficulty swallowing?", "safety"

        # Identify active symptoms
        has_bleeding = state.get("bleeding") or "bleeding_gums" in symptom_keys or "bleeding_gums_brushing" in symptom_keys
        has_pain = state.get("pain_level") is not None or "toothache" in symptom_keys or "severe_throbbing_pain" in symptom_keys
        has_swelling = state.get("swelling") or "mild_swelling" in symptom_keys
        has_sensitivity = state.get("sensitivity") or "cold_sensitivity" in symptom_keys or "hot_sensitivity" in symptom_keys

        # 2. SYMPTOM-SPECIFIC DEEP ADAPTIVE SELECTION (8-10 Question Clinical Interview)
        if has_pain:
            if state.get("location") is None and "location" not in asked_fields:
                return "location", "Which specific tooth or area is hurting (e.g., upper right back molar, lower front teeth)?", "location"
            if state.get("duration") is None and "duration" not in asked_fields:
                return "duration", "When did this tooth pain first start?", "duration"
            if state.get("pain_level") is None and "pain_level" not in asked_fields:
                return "pain_level", "On a scale of 1 to 10, how severe is the pain right now?", "pain level"
            if not details.get("triggers") and "triggers" not in asked_fields:
                return "triggers", "Does anything specific trigger or worsen the pain, like cold drinks, hot food, sweets, or biting down?", "triggers"
            if details.get("frequency") is None and "frequency" not in asked_fields:
                return "frequency", "Is the pain constant throughout the day, or does it come and go intermittently?", "frequency"
            if details.get("pain_character") is None and "pain_character" not in asked_fields:
                return "pain_character", "How would you describe the pain — is it a sharp shooting pain, a dull ache, or a throbbing sensation?", "pain_character"
            if details.get("sleep_impact") is None and "sleep_impact" not in asked_fields:
                return "sleep_impact", "Does the toothache wake you up at night or get worse when you lie down flat?", "sleep_impact"
            if state.get("swelling") is None and "swelling" not in asked_fields:
                return "swelling", "Have you noticed any swelling or tenderness in the gums or cheek around that tooth?", "swelling"
            if state.get("pus") is None and "pus" not in asked_fields:
                return "pus", "Is there any pus discharge, a small bump on the gum, or a bad taste coming from that tooth?", "pus"
            if state.get("fever") is None and "fever" not in asked_fields:
                return "fever", "Have you experienced any fever, chills, or body warmness alongside the toothache?", "fever"

        elif has_bleeding:
            if state.get("duration") is None and "duration" not in asked_fields:
                return "duration", "When did you first notice your gums starting to bleed?", "duration"
            if details.get("frequency") is None and "frequency" not in asked_fields:
                return "frequency", "Does the bleeding happen every time you brush or floss, or does it bleed spontaneously without touching?", "frequency"
            if state.get("location") is None and "location" not in asked_fields:
                return "location", "Is the bleeding localized to one specific tooth/area or all over your upper and lower gums?", "location"
            if state.get("swelling") is None and "swelling" not in asked_fields:
                return "swelling", "Are your gums swollen, red, or tender to the touch alongside the bleeding?", "swelling"
            if details.get("recession") is None and "recession" not in asked_fields:
                return "recession", "Have you noticed your gums pulling back or your teeth appearing slightly longer than before?", "recession"
            if details.get("loose_teeth") is None and "loose_teeth" not in asked_fields:
                return "loose_teeth", "Do any of your teeth feel slightly loose or wobbly when eating or chewing?", "loose_teeth"
            if details.get("bad_breath") is None and "bad_breath" not in asked_fields:
                return "bad_breath", "Have you experienced persistent bad breath or an unpleasant taste in your mouth?", "bad_breath"
            if details.get("cleaning_history") is None and "cleaning_history" not in asked_fields:
                return "cleaning_history", "Roughly when was your last professional dental cleaning or checkup?", "cleaning_history"
            if state.get("pain_level") is None and "pain_level" not in asked_fields:
                return "pain_level", "On a scale of 1 to 10, how much pain or soreness are you feeling in your gums?", "pain level"

        elif has_swelling:
            if state.get("location") is None and "location" not in asked_fields:
                return "location", "Where exactly is the swelling located (e.g., upper gum, lower jawline, inner cheek)?", "location"
            if state.get("duration") is None and "duration" not in asked_fields:
                return "duration", "How many days or hours has this swelling been present?", "duration"
            if state.get("pain_level") is None and "pain_level" not in asked_fields:
                return "pain_level", "On a scale of 1 to 10, how painful is the swollen region?", "pain level"
            if state.get("pus") is None and "pus" not in asked_fields:
                return "pus", "Is there any pus, yellowish discharge, or foul taste coming from the swollen area?", "pus"
            if state.get("fever") is None and "fever" not in asked_fields:
                return "fever", "Have you noticed any fever or general feeling of illness with this swelling?", "fever"
            if details.get("jaw_opening") is None and "jaw_opening" not in asked_fields:
                return "jaw_opening", "Can you open your mouth normally, or is your jaw stiff and painful to open?", "jaw_opening"
            if details.get("facial_spread") is None and "facial_spread" not in asked_fields:
                return "facial_spread", "Is the swelling staying in one spot, or spreading outward toward your cheek, eye, or neck?", "facial_spread"

        elif has_sensitivity:
            if state.get("location") is None and "location" not in asked_fields:
                return "location", "Which specific tooth or quadrant feels sensitive?", "location"
            if state.get("duration") is None and "duration" not in asked_fields:
                return "duration", "How long have you been experiencing this sensitivity?", "duration"
            if not details.get("triggers") and "triggers" not in asked_fields:
                return "triggers", "Is the sensitivity triggered by cold drinks, hot liquids, sweet foods, or cold air?", "triggers"
            if details.get("duration_after_trigger") is None and "duration_after_trigger" not in asked_fields:
                return "duration_after_trigger", "Does the sharp sensation vanish immediately after swallowing, or linger for several seconds?", "duration_after_trigger"

        # General Deep Fallbacks
        if state.get("location") is None and "location" not in asked_fields:
            return "location", "Where specifically in your mouth is the discomfort located (e.g., upper right gum, back molars, front teeth)?", "location"

        if state.get("duration") is None and "duration" not in asked_fields:
            return "duration", "How long has this issue been going on? (e.g., a few days, a week, or several months?)", "duration"

        if state.get("pain_level") is None and "pain_level" not in asked_fields:
            return "pain_level", "On a scale of 0 to 10, what is your current discomfort or pain level?", "pain level"

        return None

    def preprocess_text(self, text: str) -> str:
        cleaned = text.lower().strip()
        # Correct obvious typos / expand common shorthand & natural language variations
        cleaned = re.sub(r'\bgape\b', 'gap', cleaned)
        cleaned = re.sub(r'\btoot\b', 'tooth', cleaned)
        cleaned = re.sub(r'\btootache\b', 'toothache', cleaned)
        cleaned = re.sub(r'\bgm\b', 'gum', cleaned)
        cleaned = re.sub(r'\bgms\b', 'gums', cleaned)
        cleaned = re.sub(r'\bwen\b', 'when', cleaned)
        cleaned = re.sub(r'\bwit\b', 'with', cleaned)
        cleaned = re.sub(r'\btth\b', 'tooth', cleaned)
        cleaned = re.sub(r'\bbld\b', 'bleed', cleaned)
        cleaned = re.sub(r'\bsweel\b', 'swollen', cleaned)
        cleaned = re.sub(r'\bswoling\b', 'swollen', cleaned)
        cleaned = re.sub(r'\bsensitiv\b', 'sensitivity', cleaned)
        cleaned = re.sub(r'\bplz\b', 'please', cleaned)
        cleaned = re.sub(r'\bcavty\b', 'cavity', cleaned)
        cleaned = re.sub(r'\bhalitosis\b', 'bad breath', cleaned)
        cleaned = re.sub(r'\bpericoronitis\b', 'wisdom tooth swelling', cleaned)
        cleaned = re.sub(r'\bblood\b', 'bleed', cleaned)
        cleaned = re.sub(r'\bவலி\b', 'pain', cleaned)
        cleaned = re.sub(r'\bஇரத்தம்\b', 'bleed', cleaned)
        cleaned = re.sub(r'\bவீக்கம்\b', 'swollen', cleaned)
        cleaned = re.sub(r'\bசீழ்\b', 'pus', cleaned)
        return cleaned

    def match_field_value(self, field: str, text: str) -> Optional[any]:
        cleaned = text.lower().strip()
        
        if field == "location":
            if any(w in cleaned for w in ["wisdom", "அறிவு"]):
                return "wisdom tooth area"
            if any(w in cleaned for w in ["roof", "மேல்வாய்"]):
                return "roof of mouth"
            if any(w in cleaned for w in ["tongue", "நாக்கு"]):
                return "tongue"
            if any(w in cleaned for w in ["jaw", "தாடை"]):
                return "jaw joint"
            
            left_negated = re.search(r"not\s+left|left\s+not|இல்லை\s+இடது|இடது\s+இல்லை", cleaned) is not None
            right_negated = re.search(r"not\s+right|right\s+not|இல்லை\s+வலது|வலது\s+இல்லை", cleaned) is not None
            upper_negated = re.search(r"not\s+upper|not\s+top|top\s+not|upper\s+not|இல்லை\s+மேல்|மேல்\s+இல்லை", cleaned) is not None
            lower_negated = re.search(r"not\s+lower|not\s+bottom|bottom\s+not|lower\s+not|இல்லை\s+கீழ்|கீழ்\s+இல்லை", cleaned) is not None

            parts = []
            if any(w in cleaned for w in ["wisdom", "அறிவு"]):
                parts.append("wisdom tooth area")
            if any(w in cleaned for w in ["upper", "top", "மேல்", "up"]) and not upper_negated:
                parts.append("upper")
            if any(w in cleaned for w in ["lower", "bottom", "கீழ்", "down"]) and not lower_negated:
                parts.append("lower")
            if any(w in cleaned for w in ["left", "இடது"]) and not left_negated:
                parts.append("left")
            if any(w in cleaned for w in ["right", "வலது"]) and not right_negated:
                parts.append("right")
            if any(w in cleaned for w in ["front", "முன்"]):
                parts.append("front")
            if any(w in cleaned for w in ["back", "rear", "கடவாய்"]):
                parts.append("back")
            if any(w in cleaned for w in ["molar", "பல்"]):
                parts.append("molar area")
                
            if parts:
                return " ".join(parts)
            for loc in DENTAL_DB.get("locations", []):
                if loc in cleaned:
                    return loc
                    
        elif field == "duration":
            t = cleaned
            t = re.sub(r'\bone\b', '1', t)
            t = re.sub(r'\btwo\b', '2', t)
            t = re.sub(r'\bthree\b', '3', t)
            t = re.sub(r'\bfour\b', '4', t)
            t = re.sub(r'\bfive\b', '5', t)
            t = re.sub(r'\bsix\b', '6', t)
            t = re.sub(r'\bseven\b', '7', t)
            t = re.sub(r'\ba\s+week\b', '1 week', t)
            t = re.sub(r'\ba\s+day\b', '1 day', t)
            t = re.sub(r'\ba\s+month\b', '1 month', t)
            
            if re.match(r"^\d+$", t):
                return f"{t} days"
            duration_patterns = [
                (r"(\d+)\s*days?", "days"),
                (r"(\d+)\s*weeks?", "weeks"),
                (r"(\d+)\s*hours?", "hours"),
                (r"(\d+)\s*months?", "months"),
                (r"just started|overnight|today|yesterday|இப்போதுதான்", "just started")
            ]
            for pat, unit in duration_patterns:
                m = re.search(pat, t)
                if m:
                    return m.group(0)
            if any(w in cleaned for w in ["long", "month", "year", "நிறைய நாட்கள்"]):
                return "long-standing"
            if any(w in cleaned for w in ["short", "few days", "recent", "சில நாட்கள்"]):
                return "a few days"

        elif field == "pain_level":
            pain_match = re.search(r"\b([0-9]|10)\b", cleaned)
            if pain_match:
                return int(pain_match.group(1))
            if any(w in cleaned for w in ["no pain", "painless", "no", "none", "no discomfort", "வலி இல்லை"]):
                return 0
            if any(w in cleaned for w in ["severe", "excruciating", "unbearable", "extremely", "bad", "கடுமையான"]):
                return 8
            if any(w in cleaned for w in ["moderate", "medium", "average", "மிதமான"]):
                return 5
            if any(w in cleaned for w in ["mild", "slight", "sore", "irritat", "லேசான"]):
                return 2

        elif field == "frequency":
            if any(w in cleaned for w in ["always", "every time", "everytime", "mostly", "constantly", "continual", "எப்போதும்"]):
                return "every time"
            if any(w in cleaned for w in ["spontaneous", "comes and goes", "throbbing", "intermittent", "sometimes", "occasionally", "now and then", "now only", "only now", "just now", "வலியுடன்", "துடிப்பு"]):
                return "intermittent"

        elif field == "triggers":
            triggers = []
            for trig in ["brush", "floss", "chew", "eat", "cold", "hot", "sweet", "touch", "விளக்க"]:
                if trig in cleaned:
                    triggers.append(trig)
            if triggers:
                return triggers

        elif field in ["swelling", "bleeding"]:
            if any(w in cleaned for w in ["yes", "yeah", "sure", "some", "swoll", "puffy", "bleed", "blood", "ஆமாம்", "வீக்கம்", "இரத்தம்"]):
                return True
            if any(w in cleaned for w in ["no", "none", "not", "dont", "இல்லை"]):
                return False

        return None

    def build_acknowledgment(self, text: str, state: dict, details: dict, newly_extracted: dict, last_asked: str) -> str:
        cleaned = text.lower()
        tamil_mode = self.is_tamil(text)
        
        if tamil_mode:
            if last_asked == "duration" and newly_extracted.get("duration"):
                return f"சரி, இது {newly_extracted['duration']} நாட்களாக இருக்கிறது."
            if last_asked == "pain_level":
                p = state["pain_level"]
                if p == 0:
                    return "சரி, வலி இல்லை."
                elif p is not None:
                    return f"வலியின் அளவு {p}/10 எனப் பதிவு செய்யப்பட்டுள்ளது."
            if last_asked == "frequency" and details.get("frequency"):
                return f"புரிந்துகொண்டேன், இது {details['frequency']} நடக்கிறது."
            if last_asked == "swelling" and state["swelling"] is not None:
                return "வீக்கம் உள்ளது எனப் பதிவு செய்யப்பட்டுள்ளது." if state["swelling"] else "வீக்கம் இல்லை, நல்லது."
            if last_asked == "bleeding" and state["bleeding"] is not None:
                return "இரத்தப்போக்கு உள்ளது." if state["bleeding"] else "இரத்தப்போக்கு இல்லை."
            return "தகவலுக்கு நன்றி."

        if last_asked == "location" and newly_extracted.get("location"):
            l = newly_extracted["location"]
            if any(neg in str(l).lower() for neg in ["no where", "nowhere", "no place", "no specific", "no location", "none", "nothing"]):
                return "Understood, no specific tooth or gum location noted."
            if tamil_mode:
                return f"சரி, உங்கள் வாய் பகுதியில் {l} என்ற இடத்தில் பாதிப்பு உள்ளது."
            return random.choice(RESPONSE_TEMPLATES["ack_location"]).format(location=l)

        if last_asked == "duration" and newly_extracted.get("duration"):
            d = newly_extracted["duration"]
            return f"Noted, so this has been going on for {d}."
            
        if last_asked == "pain_level":
            p = state["pain_level"]
            if p == 0:
                return "Got it, no pain — just the other symptoms."
            elif p is not None:
                return f"I see, a pain level of {p}/10 — sorry you're dealing with that discomfort."
                
        if last_asked == "frequency" and details.get("frequency"):
            f = details["frequency"]
            return f"Understood, happening {f}."
            
        if last_asked == "swelling" and state["swelling"] is not None:
            if state["swelling"]:
                return "Understood, swelling is something to track closely."
            else:
                return "Reassuring that there is no visible swelling."
                
        if last_asked == "bleeding" and state["bleeding"] is not None:
            if state["bleeding"]:
                return "I understand, gum bleeding is an important symptom we need to monitor."
            else:
                return "Good to know there's no bleeding."

        symptoms = []
        if "bleed" in cleaned or "blood" in cleaned:
            symptoms.append("bleeding gums")
        if "swell" in cleaned or "swollen" in cleaned:
            symptoms.append("swelling")
        if "pain" in cleaned or "hurt" in cleaned or "ache" in cleaned:
            symptoms.append("pain")
            
        if symptoms:
            joined = " and ".join(symptoms)
            if newly_extracted.get("duration"):
                return f"Thanks for sharing that — {joined}, and it's been going on for {newly_extracted['duration']}."
            else:
                return f"Thanks for sharing that — {joined} is noted."
                
        return "Thanks for that detail."

    def get_symptom_restatement(self, state: dict, details: dict) -> str:
        parts = []
        if state.get("bleeding"):
            parts.append("bleeding gums")
        if state.get("swelling"):
            parts.append("swollen gums")
        if state.get("pain_level") is not None:
            if state["pain_level"] == 0:
                parts.append("no pain")
            else:
                parts.append(f"pain level {state['pain_level']}/10")
                
        if details.get("triggers"):
            parts.append(f"when {details['triggers'][0]}")
        elif state.get("sensitivity"):
            parts.append(f"sensitivity to {state['sensitivity']}")
            
        if details.get("frequency"):
            parts.append(f"happening {details['frequency']}")
            
        if state.get("duration"):
            parts.append(f"going on for {state['duration']}")
            
        return ", ".join(parts) if parts else "mild gum irritation"

    def handle_direct_question(self, text: str) -> Optional[str]:
        cleaned = text.lower()
        if any(w in cleaned for w in ["serious", "dangerous", "die", "bad is it", "cancer"]):
            return (
                "Since I'm an AI assistant, I can't give a definitive medical diagnosis. "
                "However, based on the symptoms you describe, we'll calculate a clinical risk level "
                "so you can understand whether you need to see a dentist urgently."
            )
        if any(w in cleaned for w in ["why do you need to know", "why do you ask", "why ask", "reason for this"]):
            return (
                "Knowing details like location, duration, and pain level helps my triage engine map your symptoms "
                "to the correct clinical concern level (Low, Moderate, or High) and suggest the best next steps."
            )
        if any(w in cleaned for w in ["cost", "money", "price", "expensive", "pay"]):
            return (
                "I can't provide pricing since dental costs depend entirely on your local clinic and insurance. "
                "However, this PerioVoice AI assessment is completely free of charge!"
            )
        return None

    def get_llm_response(self, state: dict, details: dict, next_question: str, transcript: list, tamil_mode: bool = False) -> Optional[str]:
        return llm_client.query_llm_response(state, details, next_question, transcript, tamil_mode)

    def get_llm_assessment_summary(self, triage_result: dict, restatement: str, cat_plain: str, concern_desc: str, rec_plain: str, transcript: list, tamil_mode: bool = False) -> Optional[str]:
        return llm_client.query_llm_assessment_summary(triage_result, restatement, cat_plain, concern_desc, rec_plain, transcript, tamil_mode)

    def process_chat_message(self, session_id: str, user_message: str) -> dict:
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "user_id": "guest",
                "turn_count": 0,
                "state": {
                    "location": None, "duration": None, "pain_level": None,
                    "bleeding": None, "swelling": None, "pus": None,
                    "sensitivity": None, "fever": None, "trauma": None
                },
                "details": {
                    "frequency": None,
                    "pain_level": None,
                    "duration": None,
                    "triggers": [],
                    "related": []
                },
                "extracted_symptoms": [],
                "followup_count": 0,
                "last_asked": None,
                "matched_symptom_keys": set(),
                "transcript": [],
                "completed": False
            }

        session = self.sessions[session_id]
        if "details" not in session:
            session["details"] = {
                "frequency": None,
                "pain_level": None,
                "duration": None,
                "triggers": [],
                "related": []
            }
        if "extracted_symptoms" not in session:
            session["extracted_symptoms"] = []
        if "followup_count" not in session:
            session["followup_count"] = 0

        session["turn_count"] += 1
        session["transcript"].append({"sender": "user", "text": user_message})

        # 1. Preprocess raw text input
        cleaned = self.preprocess_text(user_message)
        tamil_mode = self.is_tamil(user_message)

        last_asked = session.get("last_asked")
        matched_val = None
        if last_asked:
            matched_val = self.match_field_value(last_asked, user_message)

        # 2. Classify message type before anything else
        greeting_pattern = r"^\s*(hi+|hello+|hey+|hii+|hola+|vanakkam+|greetings|good\s+(morning|afternoon|evening))\b"
        is_greeting = bool(re.search(greeting_pattern, cleaned))
        if is_greeting:
            if tamil_mode:
                ai_reply = "வணக்கம்! 👋 நான் பெரியோவாய்ஸ் AI. உங்கள் பற்கள் அல்லது ஈறுகளில் என்ன பிரச்சனை ஏற்படுகிறது?"
            else:
                ai_reply = "Hello! 👋 I'm PerioVoice AI, your dental triage assistant. How can I help you today? Tell me what's bothering you with your teeth or gums."
            session["last_asked"] = None
            session["transcript"].append({"sender": "bot", "text": ai_reply})
            return {
                "response": ai_reply,
                "is_assessment_complete": False,
                "final_result": None,
                "conversation_transcript": session["transcript"]
            }

        small_talk = ["thanks", "thank you", "ty", "bye", "goodbye", "ok", "okay", "cool", "got it", "perfect", "thanks!", "thank you!"]
        is_small_talk = cleaned in small_talk or any(w in cleaned for w in ["thank you", "thanks", "goodbye", "see ya"])
        if is_small_talk:
            if tamil_mode:
                ai_reply = "மிக்க நன்றி! உடம்பை பார்த்துக் கொள்ளுங்கள்!"
            else:
                ai_reply = "You're very welcome! If you experience any dental issues in the future, don't hesitate to ask. Take care!"
            session["completed"] = True
            session["transcript"].append({"sender": "bot", "text": ai_reply})
            return {
                "response": ai_reply,
                "is_assessment_complete": False,
                "final_result": None,
                "conversation_transcript": session["transcript"]
            }

        # Off-topic Redirect
        is_off_topic_query = self.is_off_topic(user_message) or (
            any(w in cleaned for w in ["leg", "knee", "headache", "stomach", "chest", "back", "throat", "arm", "body"]) and
            not any(d in cleaned for d in ["teeth", "tooth", "gum", "dentist", "mouth", "molar"])
        )
        if is_off_topic_query:
            if tamil_mode:
                ai_reply = "நான் பற்கள் மற்றும் ஈறுகளின் ஆரோக்கியத்தை மட்டுமே சரிபார்க்க முடியும். பற்கள் அல்லது ஈறுகளில் ஏதேனும் தொந்தரவு உள்ளதா?"
            else:
                body_part = "that"
                for p in ["leg", "knee", "headache", "stomach", "chest", "back", "throat", "arm", "body"]:
                    if p in cleaned:
                        if "pain" in cleaned or p == "headache":
                            body_part = f"{p} pain" if p != "headache" else "headache"
                        else:
                            body_part = f"{p} pain"
                        break
                if body_part != "that":
                    ai_reply = f"I'm specifically built to help with dental and gum concerns, so I can't help with {body_part} — but if you're having any tooth or gum issues, I'm here for that!"
                else:
                    ai_reply = "I'm specifically built to help with dental and gum concerns, so I can't help with that — but if you're having any tooth or gum issues, I'm here for that!"
            session["transcript"].append({"sender": "bot", "text": ai_reply})
            return {
                "response": ai_reply,
                "is_assessment_complete": False,
                "final_result": None,
                "conversation_transcript": session["transcript"]
            }

        # Empty / Non-committal ("nothing", "idk")
        non_committal = ["nothing", "idk", "i don't know", "dont know", "none", "nothing else", "இல்லை", "ஒன்றுமில்லை"]
        is_non_committal = cleaned in non_committal
        if is_non_committal:
            if tamil_mode:
                ai_reply = "பரவாயில்லை — உங்கள் பற்கள் அல்லது ஈறுகளில் ஏதேனும் தொந்தரவு இருந்தால் தயங்காமல் என்னிடம் கூறுங்கள்."
            else:
                ai_reply = "No worries — whenever something's bothering you with your teeth or gums, just tell me and I'll take a look."
            session["transcript"].append({"sender": "bot", "text": ai_reply})
            return {
                "response": ai_reply,
                "is_assessment_complete": False,
                "final_result": None,
                "conversation_transcript": session["transcript"]
            }

        # Direct Questions directed at the bot
        bot_q_reply = self.handle_direct_question(user_message)
        if bot_q_reply:
            session["transcript"].append({"sender": "bot", "text": bot_q_reply})
            q_result = self.select_next_question(session["state"], session["details"], session.get("asked_fields", []))
            if q_result:
                q_field, next_q, q_desc = q_result
                session["last_asked"] = q_field
                session["followup_count"] += 1
                ai_reply = f"{bot_q_reply} {next_q}"
            else:
                ai_reply = bot_q_reply
            return {
                "response": ai_reply,
                "is_assessment_complete": False,
                "final_result": None,
                "conversation_transcript": session["transcript"]
            }

        # Corrections Handling
        is_correction = any(w in cleaned for w in ["actually", "no it", "sorry it", "correction", "i meant"])
        if is_correction:
            if any(w in cleaned for w in ["left", "right", "upper", "lower", "top", "bottom"]):
                new_loc = self.match_field_value("location", user_message)
                if new_loc:
                    session["state"]["location"] = new_loc
                    session["details"]["location"] = new_loc
                    confirm_msg = f"Got it, updating that to the {new_loc}."
                    
                    q_result = self.select_next_question(session["state"], session["details"], session.get("asked_fields", []))
                    if q_result:
                        q_field, next_q, q_desc = q_result
                        session["last_asked"] = q_field
                        session["followup_count"] += 1
                        ai_reply = f"{confirm_msg} {next_q}"
                    else:
                        ai_reply = confirm_msg
                    session["transcript"].append({"sender": "bot", "text": ai_reply})
                    return {
                        "response": ai_reply,
                        "is_assessment_complete": False,
                        "final_result": None,
                        "conversation_transcript": session["transcript"]
                    }

        # Gibberish / Unmatched check
        is_known_concept = (
            is_greeting or
            cleaned in small_talk or
            any(w in cleaned for w in ["yes", "no", "not", "dont", "yeah", "sure", "none", "nothing", "இல்லை"]) or
            re.search(r"\b([0-9]|10)\b", cleaned) or
            any(loc in cleaned for loc in DENTAL_DB.get("locations", [])) or
            any(s in cleaned for s in ["pain", "hurt", "sore", "bleed", "blood", "swell", "puffy", "pus", "fever", "knocked", "trauma", "teeth", "tooth", "gum"]) or
            (last_asked is not None and matched_val is not None) or
            cleaned.startswith("image scan shows")
        )
        is_gibberish = False
        if not llm_client.is_configured() and last_asked is None and not tamil_mode:
            clean_no_spaces = cleaned.replace(" ", "")
            if not is_known_concept:
                if len(clean_no_spaces) > 5:
                    fuzzy_res = self.fuzzy_match_dataset(cleaned)
                    is_gibberish = fuzzy_res.get("match_score", 0) < 45
                elif len(clean_no_spaces) > 2 and not re.search(r"[aeiouy]", cleaned):
                    is_gibberish = True
                elif len(clean_no_spaces) <= 2 and cleaned not in ["up", "lh"]:
                    is_gibberish = True

        if is_gibberish:
            fallback_phrases = [
                "I didn't quite catch a symptom there — could you describe what you're feeling in a bit more detail? For example, 'my gums bleed when I brush' or 'sharp pain in my back tooth'.",
                "I want to make sure I understand your dental concerns correctly. Could you describe your teeth or gum symptoms in another way?",
                "Could you try describing what's happening with your teeth or gums using different words? For example, specify if there is any pain, bleeding, or swelling."
            ]
            last_bot_reply = None
            for item in reversed(session["transcript"]):
                if item["sender"] == "bot":
                    last_bot_reply = item["text"]
                    break
            ai_reply = fallback_phrases[0]
            if last_bot_reply == ai_reply:
                ai_reply = fallback_phrases[1]
            elif last_bot_reply == fallback_phrases[1]:
                ai_reply = fallback_phrases[2]
                
            session["transcript"].append({"sender": "bot", "text": ai_reply})
            return {
                "response": ai_reply,
                "is_assessment_complete": False,
                "final_result": None,
                "conversation_transcript": session["transcript"]
            }

        # Emergency/critical airway check (only true life-threatening or severe facial/airway emergencies)
        is_emergency_text = any(
            w in cleaned for w in [
                "can't stop bleeding", "cannot stop bleeding", "swelling face", "swollen face", 
                "difficulty swallowing", "difficulty breathing", "choking", "knocked out tooth", 
                "unconscious", "airway emergency"
            ]
        )
        if is_emergency_text:
            session["completed"] = True
            triage_result = self.generate_final_assessment(session["state"], session["matched_symptom_keys"])
            ai_reply = (
                f"🚨 Immediate emergency dental care is advised. Your periodontal risk is high/emergency concern. "
                f"Please see a dentist or visit an urgent dental clinic within the next 24 hours. "
                f"This isn't a replacement for an in-person dental checkup."
            )
            session["transcript"].append({"sender": "bot", "text": ai_reply})
            return {
                "response": ai_reply,
                "is_assessment_complete": True,
                "final_result": triage_result,
                "conversation_transcript": session["transcript"]
            }

        # 3. Update session memory & Merge state
        newly_extracted = {}
        if last_asked:
            if matched_val is not None:
                if last_asked == "triggers":
                    if isinstance(matched_val, list):
                        session["details"]["triggers"] = list(set(session["details"].get("triggers", []) + matched_val))
                    elif matched_val not in session["details"].get("triggers", []):
                        session["details"]["triggers"].append(matched_val)
                else:
                    session["state"][last_asked] = matched_val
                    session["details"][last_asked] = matched_val
                newly_extracted[last_asked] = matched_val
            elif last_asked in ["duration", "location"]:
                words = cleaned.split()
                is_negation = any(w in ["no", "none", "nothing", "nowhere", "not", "nope", "dont", "dont know", "don't know", "no idea", "இல்லை"] for w in words) or cleaned in ["no", "none", "nothing", "nowhere", "not", "nope", "dont", "dont know", "don't know", "no idea", "இல்லை"]
                if is_negation or any(neg in cleaned for neg in ["no where", "nowhere", "no place", "no pain", "no problem", "no issue", "none", "nothing", "no discomfort"]):
                    loc_val = "no specific area" if last_asked == "location" else "Not specified"
                    session["state"][last_asked] = loc_val
                    session["details"][last_asked] = loc_val
                    newly_extracted[last_asked] = loc_val
                    matched_val = loc_val
                elif len(user_message.split()) <= 4 and not any(w in cleaned for w in ["pain", "bleed", "swell", "tooth", "teeth", "gum", "hurt"]):
                    session["state"][last_asked] = user_message
                    session["details"][last_asked] = user_message
                    newly_extracted[last_asked] = user_message
                    matched_val = user_message
                else:
                    session["state"][last_asked] = "Oral Cavity" if last_asked == "location" else "A few days"
                    session["details"][last_asked] = session["state"][last_asked]
                    matched_val = session["state"][last_asked]

        updated_state, new_symptom_keys, explicit_fields = self.extract_entities(user_message, session["state"], last_asked)
        
        # Fuzzy match against the 6000-row dataset for confidence check
        fuzzy_res = self.fuzzy_match_dataset(cleaned)
        fuzzy_score = fuzzy_res.get("match_score", 0)
        has_fuzzy_symptom = fuzzy_score >= 70

        # Check relevance
        has_matching_field = (last_asked is not None and matched_val is not None)
        has_regex_entities = (len(new_symptom_keys) > 0 or len(explicit_fields) > 0)
        is_short_answer = any(w in cleaned for w in ["yes", "no", "not", "dont", "yeah", "sure", "none", "nothing", "sometimes", "every time", "always", "pain", "painless", "இல்லை", "ஆம்"])
        
        # Relaxed check: contains any general dental keyword
        DENTAL_KEYWORDS = [
            "tooth", "teeth", "gum", "gums", "pain", "paining", "hurt", "hurts", 
            "brush", "brushing", "floss", "flossing", "bleed", "bleeding", "swell", "swelling",
            "ache", "aching", "mouth", "molar", "dentist", "gap", "gape", "wisdom"
        ]
        has_dental_keyword = any(kw in cleaned for kw in DENTAL_KEYWORDS)
        
        has_duration_pattern = bool(re.search(r"\b(\d+)\s*(days?|weeks?|months?|hours?|years?)\b|today|yesterday|just started|since|long time", cleaned))
        has_number = bool(re.search(r"\b\d+\b", cleaned))

        is_relevant_input = (
            (last_asked is not None) or
            has_matching_field or 
            has_regex_entities or 
            has_fuzzy_symptom or 
            has_dental_keyword or
            has_duration_pattern or
            has_number or
            cleaned.startswith("image scan shows") or 
            is_short_answer
        )

        # If LLM is active, we bypass this strict rejection to let the LLM handle conversation naturally.
        # If offline/rule-based, we reject only if it has no dental keyword and matches none of the rules.
        if not llm_client.is_configured() and not is_relevant_input:
            unrelated_fallbacks = [
                "That doesn't seem related to a tooth or gum symptom — could you tell me what's actually bothering you with your teeth or gums?",
                "I didn't catch any dental symptoms or details in that message. Could you describe what you're experiencing with your teeth or gums?",
                "To help you with your dental triage, I need to know about your tooth or gum concerns. Could you describe your symptoms?"
            ]
            last_bot_reply = None
            for item in reversed(session["transcript"]):
                if item["sender"] == "bot":
                    last_bot_reply = item["text"]
                    break
            ai_reply = unrelated_fallbacks[0]
            if last_bot_reply == ai_reply:
                ai_reply = unrelated_fallbacks[1]
            elif last_bot_reply == unrelated_fallbacks[1]:
                ai_reply = unrelated_fallbacks[2]
            
            if tamil_mode:
                ai_reply = "அது பற்கள் அல்லது ஈறுகளின் அறிகுறியாகத் தெரியவில்லை — உங்கள் பற்கள் அல்லது ஈறுகளில் என்ன பிரச்சனை ஏற்படுகிறது என்று கூற முடியுமா?"
                
            session["transcript"].append({"sender": "bot", "text": ai_reply})
            return {
                "response": ai_reply,
                "is_assessment_complete": False,
                "final_result": None,
                "conversation_transcript": session["transcript"]
            }

        # Apply state updates since input is relevant
        session["state"] = updated_state
        for field in explicit_fields:
            if field in ["location", "duration", "pain_level"]:
                session["details"][field] = updated_state[field]
                
        # If fuzzy match score >= 70, register as valid symptom
        if has_fuzzy_symptom:
            session["matched_symptom_keys"].add("dataset_matched_symptom")
            if "dataset_matched_symptom" not in session["extracted_symptoms"]:
                session["extracted_symptoms"].append("dataset_matched_symptom")

        for key in new_symptom_keys:
            session["matched_symptom_keys"].add(key)
            if key not in session["extracted_symptoms"]:
                session["extracted_symptoms"].append(key)

        for trigger in ["brushing", "brush", "flossing", "floss", "chewing", "chew", "eating", "eat", "cold", "hot", "sweet"]:
            if trigger in cleaned and trigger not in session["details"]["triggers"]:
                session["details"]["triggers"].append(trigger)

        # 4. Check confidence/completeness
        def count_filled_details(state: dict, details: dict) -> int:
            count = 0
            if state.get("duration") is not None or details.get("duration") is not None:
                count += 1
            if details.get("frequency") is not None:
                count += 1
            if state.get("pain_level") is not None or details.get("pain_level") is not None:
                count += 1
            if details.get("triggers") and len(details["triggers"]) > 0:
                count += 1
            if state.get("location") is not None or details.get("location") is not None:
                count += 1
            return count

        filled_details_count = count_filled_details(session["state"], session["details"])
        has_real_symptom = len(session["extracted_symptoms"]) > 0 or len(session["matched_symptom_keys"]) > 0
        
        known_high_value_fields = [
            session["details"].get("duration") is not None,
            session["details"].get("frequency") is not None,
            session["details"].get("pain_level") is not None,
            len(session["details"].get("triggers", [])) > 0,
            session["state"]["swelling"] is not None or session["state"]["bleeding"] is not None
        ]
        high_value_fields_count = sum(1 for f in known_high_value_fields if f)

        # Select next question first before deciding completion
        q_result = self.select_next_question(session["state"], session["details"], session.get("asked_fields", []), session["matched_symptom_keys"])

        # Completion rule: Only complete when NO more relevant questions exist (q_result is None) OR 8+ followups completed
        is_complete = (
            has_real_symptom and
            (q_result is None or session["followup_count"] >= 8 or session.get("completed", False)) and
            filled_details_count >= 3
        )

        if is_complete:
            session["completed"] = True
            triage_result = self.generate_final_assessment(session["state"], session["matched_symptom_keys"])
            
            category_plain_names = {
                "Gingival Inflammation (Gingivitis)": "early gum inflammation (gingivitis), which is very common and usually manageable at home",
                "Chronic Periodontitis": "chronic gum disease (periodontitis), which involves progressive inflammation of the gums and supporting bone",
                "Localized Periodontal Abscess": "a localized gum infection (periodontal abscess), which requires prompt attention from a dentist",
                "Acute Necrotizing Ulcerative Gingivitis (ANUG)": "a severe painful gum infection (ANUG) that needs immediate professional treatment",
                "Acute Irreversible Pulpitis / Periapical Involvement": "inflammation of the tooth nerve (pulpitis), which typically requires dental evaluation",
                "Dental Trauma / Tooth Avulsion": "dental trauma from physical impact",
                "Severe Facial Cellulitis / Submandibular Abscess": "a spreading facial tissue infection (cellulitis), which is a serious condition requiring immediate emergency care",
                "Temporomandibular Joint (TMJ) Dysfunction": "jaw joint dysfunction (TMJ), which can cause discomfort but is typically not an infection"
            }
            
            recommendation_plain_texts = {
                "Gingival Inflammation (Gingivitis)": "Try switching to a softer toothbrush and flossing gently for the next week — if the bleeding continues past that, it's worth getting it checked by a dentist.",
                "Chronic Periodontitis": "It is important to schedule a professional cleaning and examination within the next few weeks to halt any further attachment loss.",
                "Localized Periodontal Abscess": "Please schedule an urgent dental appointment. You can rinse with warm salt water and take over-the-counter pain relievers in the meantime, but avoid chewing on that side.",
                "Acute Necrotizing Ulcerative Gingivitis (ANUG)": "Please schedule an urgent dental appointment. You can rinse with warm salt water and take over-the-counter pain relievers in the meantime, but avoid chewing on that side.",
                "Acute Irreversible Pulpitis / Periapical Involvement": "Please schedule an urgent dental appointment. You can rinse with warm salt water and take over-the-counter pain relievers in the meantime, but avoid chewing on that side.",
                "Dental Trauma / Tooth Avulsion": "You should seek urgent dental or emergency room care within 24 hours. Do not wait for symptoms to worsen.",
                "Severe Facial Cellulitis / Submandibular Abscess": "You should seek urgent dental or emergency room care within 24 hours. Do not wait for symptoms to worsen.",
                "Temporomandibular Joint (TMJ) Dysfunction": "You may use warm compresses on the side of your face and avoid hard foods. It is recommended to schedule a checkup if it persists."
            }

            restatement = self.get_symptom_restatement(session["state"], session["details"])
            cat_display = triage_result["condition_category"]
            cat_plain = category_plain_names.get(cat_display, cat_display.lower())
            rec_plain = recommendation_plain_texts.get(cat_display, triage_result["recommendation"])

            urg = triage_result["urgency"]
            concern_desc = "low-to-moderate concern"
            if urg == "LOW":
                concern_desc = "low concern"
            elif urg == "MODERATE":
                concern_desc = "moderate concern"
            elif urg == "HIGH":
                concern_desc = "high concern"
            elif urg == "EMERGENCY":
                concern_desc = "high severity/emergency concern"

            ai_reply = self.get_llm_assessment_summary(triage_result, restatement, cat_plain, concern_desc, rec_plain, session["transcript"], tamil_mode)
            if not ai_reply:
                ai_reply = (
                    f"Based on what you've described — {restatement} — your symptoms might be associated with {cat_plain}.\n\n"
                    f"Preliminary Urgency: {urg} ({concern_desc}). {rec_plain}\n\n"
                    f"📊 Would you like me to summarize and generate your full clinical report now?"
                )
            elif "summarize" not in ai_reply.lower() and "report" not in ai_reply.lower():
                ai_reply += "\n\n📊 Would you like me to summarize and generate your full clinical report now?"
            
            session["transcript"].append({"sender": "bot", "text": ai_reply})
            return {
                "response": ai_reply,
                "is_assessment_complete": True,
                "final_result": triage_result,
                "conversation_transcript": session["transcript"]
            }

        # 6. Ask ONE relevant follow-up question
        q_result = self.select_next_question(session["state"], session["details"], session.get("asked_fields", []))
        if q_result is None:
            session["completed"] = True
            triage_result = self.generate_final_assessment(session["state"], session["matched_symptom_keys"])
            ai_reply = (
                f"Thank you for providing those details.\n\n"
                f"Based on your responses, your symptoms might be associated with {triage_result['condition_category']}.\n\n"
                f"📊 Would you like me to summarize and generate your full clinical report now?"
            )
            session["transcript"].append({"sender": "bot", "text": ai_reply})
            return {
                "response": ai_reply,
                "is_assessment_complete": True,
                "final_result": triage_result,
                "conversation_transcript": session["transcript"]
            }

        q_field, next_q, q_desc = q_result
        if "asked_fields" not in session:
            session["asked_fields"] = []
        if q_field not in session["asked_fields"]:
            session["asked_fields"].append(q_field)

        # Check if the question is going to be identical to what was last asked to avoid loop
        last_bot_reply = None
        for item in reversed(session["transcript"]):
            if item["sender"] == "bot":
                last_bot_reply = item["text"]
                break

        if last_bot_reply and next_q in last_bot_reply:
            rephrased_questions = {
                "duration": "Just to confirm — could you estimate how many days or weeks it's been going on?",
                "frequency": "Does this symptom happen every single time, or is it more of a random occurrence?",
                "pain_level": "Would you rate the pain as mild, moderate, or severe?",
                "triggers": "Does anything specific trigger it, like cold drinks, hot food, or brushing?",
                "swelling": "Is there any puffiness or swelling around that area at all?",
                "bleeding": "Do your gums bleed when you brush, or sometimes on their own?"
            }
            next_q = rephrased_questions.get(q_field, f"Could you provide some more details about the {q_desc}?")

        session["last_asked"] = q_field
        session["followup_count"] += 1

        ack_prefix = self.build_acknowledgment(user_message, session["state"], session["details"], newly_extracted, last_asked)
        
        # Try getting Dynamic LLM Response for follow-up question
        ai_reply = self.get_llm_response(session["state"], session["details"], next_q, session["transcript"], tamil_mode)
        if not ai_reply:
            ai_reply = f"{ack_prefix} {next_q}"

        session["transcript"].append({"sender": "bot", "text": ai_reply})
        return {
            "response": ai_reply,
            "is_assessment_complete": False,
            "final_result": None,
            "conversation_transcript": session["transcript"]
        }

    def generate_final_assessment(self, state: dict, symptom_keys: set) -> dict:
        symptoms_db = DENTAL_DB.get("symptoms", {})
        condition_categories = DENTAL_DB.get("condition_categories", {})

        matched_names = []
        for key in symptom_keys:
            if key in symptoms_db:
                item = symptoms_db[key]
                matched_names.append(item.get("display_name", key))
            elif key == "dataset_matched_symptom":
                matched_names.append("Reported Dental Discomfort")

        if not matched_names:
            matched_names = ["Gingival Erythema / Mild Discomfort"]

        # Calculate dynamic clinical risk score (scale 1 to 10) based on pain & disease severity
        p_lvl = state.get("pain_level")
        if p_lvl is None or not isinstance(p_lvl, (int, float)):
            p_lvl = 2  # Default to mild pain (2/10) if unstated
            
        base_score = float(p_lvl)

        if state.get("bleeding"):
            base_score += 1.0
        if state.get("swelling"):
            base_score += 1.5
        if state.get("pus") or state.get("fever"):
            base_score += 2.5
        if state.get("trauma") or "severe_facial_swelling" in symptom_keys:
            base_score += 4.0

        risk_score = min(10, max(1, round(base_score)))

        # Categorize urgency dynamically (1-3 LOW, 4-6 MODERATE, 7-8 HIGH, 9-10 EMERGENCY)
        if state.get("trauma") or "severe_facial_swelling" in symptom_keys or risk_score >= 9:
            urgency = "EMERGENCY"
            rationale = "Immediate emergency dental care required due to potential facial cellulitis, severe trauma, or airway risk."
            rec = "🚨 EMERGENCY: Seek urgent clinical dental or emergency room evaluation within 24 hours."
            if "severe_facial_swelling" in symptom_keys:
                condition_cat = "cellulitis_ludwigs"
            elif state.get("trauma"):
                condition_cat = "dental_trauma_avulsion"
            else:
                condition_cat = "irreversible_pulpitis"
        elif risk_score >= 7 or state.get("pus") or state.get("fever"):
            urgency = "HIGH"
            rationale = "High periodontal urgency recommended due to severe pain, acute infection, or purulent exudate."
            rec = "🔴 HIGH URGENCY: Schedule a clinical periodontal appointment within 48 hours."
            condition_cat = "periodontal_abscess" if state.get("pus") else "irreversible_pulpitis"
        elif risk_score >= 4:
            urgency = "MODERATE"
            rationale = "Moderate risk calculated based on moderate pain intensity, active gum bleeding, or localized inflammation."
            rec = "🟡 MODERATE: Schedule professional scaling and periodontal examination within 7 to 14 days."
            condition_cat = "chronic_periodontitis" if state.get("swelling") else "gingivitis"
        else:
            urgency = "LOW"
            rationale = "Low periodontal risk. Symptoms indicate mild reversible gingival irritation with low pain intensity."
            rec = "🟢 LOW RISK: Maintain daily oral hygiene and routine dental checkups."
            condition_cat = "gingivitis"

        cat_info = condition_categories.get(condition_cat, {
            "display_name": "Periodontal Health Evaluation",
            "description": "General periodontal symptom assessment."
        })

        home_care_tips = [
            "Brush twice daily using soft bristles angled at 45 degrees to the gumline.",
            "Floss gently between all teeth once daily.",
            "Rinse with warm salt water or an alcohol-free antimicrobial rinse."
        ]
        if urgency in ["HIGH", "EMERGENCY"]:
            home_care_tips.insert(0, "Avoid chewing on affected area and refrain from hot, acidic, or hard foods.")

        return {
            "urgency": urgency,
            "risk_score": risk_score,
            "symptoms": matched_names,
            "location": state.get("location") or "Oral Cavity",
            "duration": state.get("duration") or "Not specified",
            "condition_category": cat_info["display_name"],
            "condition_description": cat_info["description"],
            "urgency_rationale": rationale,
            "recommendation": rec,
            "home_care_tips": home_care_tips,
            "emergency_warning_signs": DENTAL_DB.get("emergency_warning_signs", []),
            "should_see_dentist": urgency != "LOW",
            "disclaimer": "⚠️ DISCLAIMER: This is an automated AI-based triage assessment for informational purposes only. It is not a professional medical diagnosis. Please consult a licensed dentist."
        }

triage_state_engine = TriageStateEngine()
