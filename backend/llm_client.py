"""
llm_client.py — PerioVoice AI™ Intelligent Conversational LLM Client

Acts as the modular gatekeeper for external LLMs (OpenAI / Gemini / Fallback Engine).
Strictly enforces the 11-point adaptive conversational triage guidelines:
- Ask ONLY ONE question at a time.
- Dynamically adapt questions based ONLY on the user's previous answers.
- Detect critical red flags (breathing/swallowing difficulty, severe swelling, heavy bleeding).
- Non-diagnostic, probabilistic clinical language.
"""

import os
from typing import Optional, List, Dict
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

USE_LLM = os.getenv("USE_LLM", "true").lower() == "true"


def is_configured() -> bool:
    """Check if an external LLM key (e.g. OPENAI_API_KEY or GEMINI_API_KEY) is configured."""
    if not USE_LLM:
        return False
    return bool(os.getenv("OPENAI_API_KEY")) or bool(os.getenv("GEMINI_API_KEY"))


SYSTEM_TRIAGE_INSTRUCTIONS = """
You are PerioVoice AI™, an intelligent, empathetic conversational dental symptom assessment assistant.

Your job is to have a natural, patient-friendly conversation with the user about dental and periodontal symptoms and provide a preliminary urgency recommendation.

IMPORTANT RULES:
1. DO NOT behave like a fixed questionnaire.
2. DO NOT ask a long list of questions in a single turn. Ask ONLY ONE question at a time.
3. DO NOT ask irrelevant questions or repeat information the user already provided.
4. Dynamically decide the NEXT BEST QUESTION based ONLY on the user's previous answer and symptoms.
5. If the user's input is a greeting (e.g., "hi", "hello"), reply warmly and ask them to describe their tooth or gum symptoms in their own words.
6. CRITICAL SAFETY / RED FLAGS: If the user reports difficulty breathing, difficulty swallowing, severe rapidly spreading facial swelling, or heavy uncontrolled bleeding:
   -> Immediately tell the user to seek emergency medical/dental care right away. Do NOT continue routine questioning.
7. DO NOT DIAGNOSE: Use probabilistic terms like "This could be caused by...", "Possible causes include...", "A dentist would need to examine you to determine the exact cause."
8. URGENCY CLASSIFICATION: When enough information is collected, categorize into:
   - 🟢 LOW / ROUTINE
   - 🟡 MODERATE / DENTAL APPOINTMENT
   - 🟠 PROMPT DENTAL EVALUATION
   - 🔴 URGENT / EMERGENCY

Symptom-Specific Follow-up Guidance:
- TOOTH PAIN: Location, onset/duration, pain scale (1-10), triggers (hot/cold/sweet/chewing), swelling/fever/pus.
- GUM BLEEDING: Brushing vs spontaneous, heavy vs mild, duration, gum tenderness/swelling.
- SWOLLEN GUMS: Location, onset, pain, pus/bad taste, facial swelling.
- TOOTH SENSITIVITY: Hot/cold/sweet triggers, duration after trigger, chewing pain.
- GAP BETWEEN TEETH: Location, long-standing vs recent, widening, food impaction, pain/bleeding.
- BAD BREATH: Duration, persistence, gum bleeding, dry mouth, bad taste.
- LOOSE TEETH: Location, duration, trauma history, pain/swelling/pus.
- BROKEN/CHIPPED TOOTH: Onset, trauma history, pain, sharp edge cutting cheek/tongue.
- MOUTH ULCER/SORE: Location, duration, pain, history of recurrences.
"""


def query_llm_response(
    state: dict,
    details: dict,
    next_question: str,
    transcript: list,
    tamil_mode: bool = False,
) -> Optional[str]:
    """
    Query configured LLM (e.g. OpenAI) to generate a natural, empathetic 1-question response.
    Returns None if no external LLM key is configured (falling back to adaptive triage state engine).
    """
    if not is_configured():
        return None

    openai_api_key = os.getenv("OPENAI_API_KEY")

    lang_instruction = (
        "You MUST generate your entire response in Tamil language (தமிழ்). "
        if tamil_mode
        else "You MUST generate your entire response in English. Do NOT use Tamil."
    )

    system_prompt = (
        f"{SYSTEM_TRIAGE_INSTRUCTIONS}\n\n"
        "Current Clinical Context Collected So Far:\n"
        f"- Location: {state.get('location') or 'Not specified'}\n"
        f"- Duration: {state.get('duration') or 'Not specified'}\n"
        f"- Pain Level: {state.get('pain_level') if state.get('pain_level') is not None else 'Not specified'}\n"
        f"- Bleeding: {state.get('bleeding') if state.get('bleeding') is not None else 'Not specified'}\n"
        f"- Swelling: {state.get('swelling') if state.get('swelling') is not None else 'Not specified'}\n"
        f"- Pus/Discharge: {state.get('pus') if state.get('pus') is not None else 'Not specified'}\n\n"
        "Your Immediate Goal for this Turn:\n"
        "1. Briefly acknowledge what the user just said with warm clinical empathy (max 1 sentence).\n"
        f"2. Seamlessly ask ONLY ONE relevant next question: '{next_question}'.\n"
        "3. Keep your response short, clear, and encouraging (max 2-3 sentences total).\n"
        f"4. Language requirement: {lang_instruction}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in transcript[-8:]:
        role = "user" if msg.get("sender") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})

    if openai_api_key:
        try:
            import openai
            openai.api_key = openai_api_key
            response = openai.ChatCompletion.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=messages,
                temperature=0.3,
                max_tokens=150,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠️ OpenAI query failed in follow-up: {e}")

    return None


def query_llm_image_continuation(
    findings: List[str],
    recommendation: str,
    transcript: list,
    tamil_mode: bool = False,
) -> Optional[str]:
    """
    Query LLM to present visual image findings AND ask a seamless continuation question.
    """
    if not is_configured():
        return None

    openai_api_key = os.getenv("OPENAI_API_KEY")

    lang_instruction = "Respond in Tamil (தமிழ்)." if tamil_mode else "Respond in English."
    findings_str = "; ".join(findings) if findings else "Visual signs of localized tissue variation."

    system_prompt = (
        f"{SYSTEM_TRIAGE_INSTRUCTIONS}\n\n"
        "The patient just uploaded a photo of their teeth/gums. Visual findings from analysis:\n"
        f"- Findings: {findings_str}\n"
        f"- Initial Note: {recommendation}\n\n"
        "Your Instructions:\n"
        "1. Start with '📷 Visual Scan Findings:' and briefly state what was observed in 1 warm, clear sentence.\n"
        "2. Immediately ask ONE relevant continuation question to learn more about how the area feels (e.g. pain level, duration, or bleeding when brushing).\n"
        "3. Maximum 3 sentences total.\n"
        f"4. Language requirement: {lang_instruction}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in transcript[-6:]:
        role = "user" if msg.get("sender") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})

    if openai_api_key:
        try:
            import openai
            openai.api_key = openai_api_key
            response = openai.ChatCompletion.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=messages,
                temperature=0.3,
                max_tokens=150,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠️ OpenAI image continuation failed: {e}")

    return None


def query_llm_assessment_summary(
    triage_result: dict,
    restatement: str,
    cat_plain: str,
    concern_desc: str,
    rec_plain: str,
    transcript: list,
    tamil_mode: bool = False,
) -> Optional[str]:
    """
    Query LLM to generate the final clinical report summary.
    """
    if not is_configured():
        return None

    openai_api_key = os.getenv("OPENAI_API_KEY")

    lang_instruction = (
        "You MUST generate your entire response in Tamil language (தமிழ்)."
        if tamil_mode
        else "You MUST generate your entire response in English language."
    )

    system_prompt = (
        f"{SYSTEM_TRIAGE_INSTRUCTIONS}\n\n"
        "The clinical assessment is complete. Generate a warm, clear, and structured final summary:\n\n"
        f"You reported: {restatement}\n"
        f"Category: {cat_plain}\n"
        f"Urgency Level: {concern_desc}\n"
        f"Recommendation: {rec_plain}\n\n"
        "Instructions:\n"
        "1. Structure your summary clearly with sections: 'Reported Symptoms', 'Preliminary Assessment', 'Urgency', and 'Recommended Next Steps'.\n"
        f"2. Use non-diagnostic terms ('This pattern can occur with...').\n"
        f"3. Embed this exact urgency category: {concern_desc}.\n"
        f"4. State clearly: 'This is a preliminary symptom assessment, not a confirmed medical diagnosis.'\n"
        f"5. Language requirement: {lang_instruction}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in transcript[-8:]:
        role = "user" if msg.get("sender") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})

    if openai_api_key:
        try:
            import openai
            openai.api_key = openai_api_key
            response = openai.ChatCompletion.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=messages,
                temperature=0.3,
                max_tokens=280,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠️ OpenAI summary failed: {e}")

    return None
