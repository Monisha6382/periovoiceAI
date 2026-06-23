"""
LLM client wrapper for PerioVoice AI.

Supports OpenAI ChatCompletion if configured via environment variables.
Falls back gracefully when the API key or package is unavailable.
"""
import os

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

try:
    import openai
    openai.api_key = OPENAI_API_KEY
    if OPENAI_API_KEY:
        openai_available = True
    else:
        openai_available = False
except Exception:
    openai = None
    openai_available = False


def is_configured() -> bool:
    return openai_available and bool(OPENAI_API_KEY)


def query_llm(prompt: str, max_tokens: int = 300) -> str:
    """Query the configured LLM and return the assistant response."""
    if not is_configured():
        return (
            "LLM is not configured. Set OPENAI_API_KEY to use the LLM comparison feature. "
            "Falling back to the rule-based assistant output."
        )

    try:
        response = openai.ChatCompletion.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a dental symptom assistant. Provide concise, clinically minded responses and ask the next relevant question if appropriate."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"LLM query failed: {e}"


def build_prompt(message: str, conversation: list, question_index: int) -> str:
    """Build a prompt for the LLM based on session history and the latest user message."""
    transcript = "\n".join(
        [f"User: {item.get('text', '')}" if item.get('isUser') else f"Assistant: {item.get('text', '')}" for item in conversation]
    )
    prompt = (
        "The following is a conversation between a dental assistant and a patient. "
        "Based on the current conversation and the latest patient input, provide a concise response and if the assessment is not complete, ask the next appropriate follow-up question. "
        "Do not provide a final assessment unless sufficient information has been collected.\n\n"
        f"Conversation so far:\n{transcript}\n\n"
        f"Latest patient input: {message}\n\n"
        f"The next message should be written as the assistant."
    )
    return prompt
