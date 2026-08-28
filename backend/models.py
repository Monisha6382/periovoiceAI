"""
Data models for PerioVoice AI backend.
These define the structure of requests and responses.
"""

from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


# ========== ENUM FOR URGENCY LEVELS ==========
class UrgencyLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    EMERGENCY = "EMERGENCY"


class InputType(str, Enum):
    TEXT = "text"
    VOICE = "voice"
    IMAGE = "image"


# ========== REQUEST MODELS ==========
class ChatMessage(BaseModel):
    """
    User message in the chat.
    The user sends either text, voice transcript, or image description.
    """
    user_id: str
    message: str
    input_type: InputType = InputType.TEXT
    session_id: Optional[str] = None


class ImageAnalysisRequest(BaseModel):
    """
    Request to analyze a dental image.
    """
    user_id: str
    image_base64: str  # Image encoded as base64 string
    session_id: Optional[str] = None


class SaveAssessmentRequest(BaseModel):
    """
    Request to save a completed assessment.
    """
    user_id: str
    session_id: str
    conversation_transcript: List[dict]
    urgency_level: UrgencyLevel
    risk_score: int
    symptoms_found: List[str]
    recommendation: str
    detected_from_image: Optional[str] = None
    image_url: Optional[str] = None


# ========== RESPONSE MODELS ==========
class ChatResponse(BaseModel):
    """
    AI response in the conversation.
    """
    response: str  # AI's message
    session_id: str
    is_assessment_complete: bool = False
    next_question: Optional[str] = None
    final_result: Optional['AssessmentResult'] = None
    conversation_transcript: Optional[List[dict]] = None


class LLMResponse(BaseModel):
    """
    LLM assistant response for comparison.
    """
    response: str
    model: Optional[str] = None
    source: str = "llm"
    is_assessment_complete: bool = False
    next_question: Optional[str] = None


class ComparisonResponse(BaseModel):
    """
    Rule-based and LLM comparison payload.
    """
    rule_based: ChatResponse
    llm: LLMResponse


class AssessmentResult(BaseModel):
    """
    Final assessment result after collecting all symptoms.
    """
    urgency_level: UrgencyLevel
    risk_score: int  # 1 to 10
    symptoms_found: List[str]
    detected_from_image: Optional[str] = None  # What the image shows
    recommendation: str
    home_care_tips: List[str]
    should_see_dentist: bool
    disclaimer: str = "This is not a medical diagnosis"
    
    # Extra fields for front-end compatibility & rich report display
    urgency: Optional[str] = None
    symptoms: Optional[List[str]] = None
    location: Optional[str] = "Oral Cavity"
    duration: Optional[str] = "Not specified"
    condition_category: Optional[str] = "Periodontal Assessment"
    condition_description: Optional[str] = ""
    urgency_rationale: Optional[str] = ""


class HistoryItem(BaseModel):
    """
    A single assessment from user's history.
    """
    assessment_id: str
    date: str
    urgency_level: UrgencyLevel
    risk_score: int
    symptoms: List[str]
    recommendation: str


class UserAssessmentHistory(BaseModel):
    """
    All assessments for a user.
    """
    user_id: str
    assessments: List[HistoryItem]


ChatResponse.model_rebuild()