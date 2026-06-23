"""
PerioVoice AI™ - Backend API
FastAPI server for conversational dental symptom assessment.

This is the main entry point for the backend.
It handles API requests for chat, image analysis, and assessment saving.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uuid
from datetime import datetime
import os
from dotenv import load_dotenv

from backend.models import (
    ChatMessage,
    ChatResponse,
    ComparisonResponse,
    SaveAssessmentRequest,
    AssessmentResult,
    UrgencyLevel,
)
from backend.ai_engine import PeriovoiceAIEngine
from backend.image_analyzer import image_analyzer
from backend.firebase_config import firebase_manager
from backend.pdf_generator import pdf_generator
from backend.llm_client import OPENAI_MODEL, build_prompt, query_llm, is_configured
from backend import local_store
import json
from pathlib import Path

# Load environment variables from .env file
load_dotenv()

# ========== INITIALIZE AI ENGINE ==========
ai_engine = PeriovoiceAIEngine()

# ========== LIFESPAN EVENT ==========
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    print("🚀 PerioVoice AI Backend Starting...")
    print("📱 Welcome to PerioVoice AI™ - Periodontal Symptom Assessment System")
    yield
    print("🛑 Shutting down...")


# ========== CREATE FASTAPI APP ==========
app = FastAPI(
    title="PerioVoice AI™ Backend",
    description="AI-Driven Conversational System for Periodontal Symptom Assessment",
    version="1.0.0",
    lifespan=lifespan,
)

# ========== CORS MIDDLEWARE ==========
# Allow requests from frontend (React) and mobile (Flutter)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://localhost:5173",  # Vite dev server
        "https://periovoice-web.vercel.app",  # Production web
        "*",  # Allow all for mobile testing (restrict in production)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== HEALTH CHECK ==========
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Simple health check endpoint.
    Returns status to verify the backend is running.
    """
    return {
        "status": "healthy",
        "service": "PerioVoice AI Backend",
        "timestamp": datetime.now().isoformat(),
    }


# ========== START NEW ASSESSMENT SESSION ==========
@app.post("/api/start", tags=["Assessment"])
async def start_assessment(user_id: str):
    """
    Start a new assessment session.
    
    Parameters:
    - user_id: Unique identifier for the user
    
    Returns:
    - session_id: Unique ID for this assessment session
    - greeting: Initial greeting from AI
    - first_question: First question to ask user
    """
    try:
        # Generate unique session ID
        session_id = str(uuid.uuid4())

        # Start new AI session
        greeting, first_question = ai_engine.start_new_session(session_id, user_id)

        return {
            "session_id": session_id,
            "greeting": greeting,
            "first_question": first_question,
            "status": "session_started",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting session: {str(e)}")


# ========== CHAT ENDPOINT ==========
@app.post("/api/chat", response_model=ChatResponse, tags=["Assessment"])
async def chat(message: ChatMessage):
    """
    Send a message and get AI response.
    
    The AI will ask follow-up questions one by one.
    After collecting enough information, it will return the assessment.
    
    Parameters:
    - user_id: User identifier
    - message: User's message (text, voice transcript, or image description)
    - input_type: Type of input (text, voice, image)
    - session_id: Current session ID
    
    Returns:
    - response: AI's reply
    - session_id: Session ID
    - is_assessment_complete: True if assessment is done
    - next_question: The next question to ask
    """
    try:
        # Validate session
        if message.session_id not in ai_engine.sessions:
            raise HTTPException(status_code=400, detail="Invalid session ID")

        # Store the incoming user message in session conversation
        session_data = ai_engine.get_session_data(message.session_id)
        if session_data is not None:
            session_data.setdefault("conversation", []).append(
                {
                    "isUser": True,
                    "text": message.message,
                    "timestamp": datetime.now().isoformat(),
                }
            )

        # Process user's message using Gemini LLM as main chatbot
        ai_response = ai_engine.get_llm_response(message.message, session_data)

        # Keep rule-based engine running in background for scoring/comparison
        _, is_complete = ai_engine.process_user_response(
            message.session_id, message.message
        )

        # Prepare response metadata
        next_question = ""
        final_result = None

        if is_complete:
            # Generate final assessment result
            urgency, risk_score, symptoms, explanation = ai_engine.calculate_urgency(
                message.session_id
            )
            recommendation, home_care_tips, should_see_dentist = (
                ai_engine.generate_recommendation(urgency, risk_score, symptoms)
            )

            # Append AI completion message to conversation
            if session_data is not None:
                session_data["conversation"].append(
                    {
                        "isUser": False,
                        "text": ai_response,
                        "timestamp": datetime.now().isoformat(),
                    }
                )

            final_result = AssessmentResult(
                urgency_level=urgency,
                risk_score=risk_score,
                symptoms_found=symptoms,
                detected_from_image=session_data.get("image_description") if session_data else None,
                recommendation=recommendation,
                home_care_tips=home_care_tips,
                should_see_dentist=should_see_dentist,
            )

            ai_response += (
                f"\n\n{'='*50}\n"
                f"🔍 **ASSESSMENT COMPLETE**\n"
                f"{'='*50}\n"
                f"{recommendation}"
            )
        else:
            # Get the next question
            next_question = ai_engine.get_next_question(message.session_id)

        return ChatResponse(
            response=ai_response,
            session_id=message.session_id,
            is_assessment_complete=is_complete,
            next_question=next_question,
            final_result=final_result,
            conversation_transcript=session_data.get("conversation") if session_data else None,
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")


# ========== LLM ENDPOINTS ==========
@app.post("/api/llm-chat", tags=["LLM"])
async def llm_chat(message: ChatMessage):
    """Send the user message to the configured LLM and get a response."""
    try:
        if not message.session_id or message.session_id not in ai_engine.sessions:
            raise HTTPException(status_code=400, detail="Valid session_id is required for LLM chat.")

        session_data = ai_engine.get_session_data(message.session_id)
        prompt = build_prompt(message.message, session_data.get("conversation", []), session_data.get("question_index", 0))
        llm_text = query_llm(prompt)

        return {
            "response": llm_text,
            "model": OPENAI_MODEL if is_configured() else None,
            "source": "llm",
            "is_assessment_complete": False,
            "next_question": None,
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying LLM: {str(e)}")


@app.post("/api/compare-chat", response_model=ComparisonResponse, tags=["LLM"])
async def compare_chat(message: ChatMessage):
    """Compare the rule-based reply and the LLM reply for the same user message."""
    try:
        if not message.session_id or message.session_id not in ai_engine.sessions:
            raise HTTPException(status_code=400, detail="Valid session_id is required for comparison.")

        session_data = ai_engine.get_session_data(message.session_id)
        rule_text, rule_complete, rule_next, rule_final = ai_engine.simulate_response(message.session_id, message.message)

        prompt = build_prompt(message.message, session_data.get("conversation", []), session_data.get("question_index", 0))
        llm_text = query_llm(prompt)

        rule_response = ChatResponse(
            response=rule_text,
            session_id=message.session_id,
            is_assessment_complete=rule_complete,
            next_question=rule_next,
            final_result=rule_final,
            conversation_transcript=session_data.get("conversation", []),
        )

        llm_response = {
            "response": llm_text,
            "model": OPENAI_MODEL if is_configured() else None,
            "source": "llm",
            "is_assessment_complete": False,
            "next_question": None,
        }

        return {
            "rule_based": rule_response,
            "llm": llm_response,
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error comparing AI systems: {str(e)}")


# ========== IMAGE ANALYSIS ENDPOINT ==========
@app.post("/api/image", tags=["Assessment"])
async def analyze_image(file: UploadFile = File(...), session_id: str = None):
    """
    Upload and analyze a dental image.
    
    The image is analyzed to detect visible dental issues.
    
    Parameters:
    - file: Image file (JPG or PNG, max 5MB)
    - session_id: Current session ID (optional)
    
    Returns:
    - image_description: What the AI detected in the image
    - visual_risk_score: Risk score from image analysis (0-10)
    - symptoms_from_image: List of visual symptoms detected
    - findings: Detailed visual findings
    """
    try:
        # Read file contents
        contents = await file.read()

        # Validate and analyze the image
        analysis_result = image_analyzer.analyze_image(contents)

        # Check if analysis was successful
        if analysis_result["status"] != "success":
            raise HTTPException(status_code=400, detail=analysis_result["message"])

        analysis = analysis_result["analysis"]

        # If session_id provided, add to session
        if session_id and session_id in ai_engine.sessions:
            # Store image data in session
            ai_engine.sessions[session_id]["image_analysis"] = {
                "visual_risk_score": analysis["visual_risk_score"],
                "symptoms_from_image": analysis["symptoms_from_image"],
                "findings": analysis["visual_findings"],
            }
            ai_engine.add_image_description(session_id, analysis["detailed_description"])

        return {
            "status": "success",
            "image_description": analysis["detailed_description"],
            "visual_risk_score": analysis["visual_risk_score"],
            "symptoms_detected": analysis["symptoms_from_image"],
            "findings": analysis["visual_findings"],
            "color_analysis": analysis["color_analysis"],
            "recommendations": analysis["recommendations"],
            "disclaimer": "This is an automated analysis. Consult a dentist for diagnosis.",
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing image: {str(e)}")


# ========== SAVE ASSESSMENT ENDPOINT ==========
@app.post("/api/save", tags=["Assessment"])
async def save_assessment(request: SaveAssessmentRequest):
    """
    Save the completed assessment to database.
    
    Parameters:
    - user_id: User identifier
    - session_id: Assessment session ID
    - conversation_transcript: Full chat history
    - urgency_level: Determined urgency level
    - risk_score: Risk score (1-10)
    - symptoms_found: List of detected symptoms
    - recommendation: AI recommendation
    - image_url: URL of uploaded image (if any)
    
    Returns:
    - assessment_id: ID of saved assessment
    - status: Success confirmation
    - pdf_url: URL for the generated assessment PDF
    """
    try:
        assessment_id = str(uuid.uuid4())

        assessment_data = {
            "assessment_id": assessment_id,
            "user_id": request.user_id,
            "session_id": request.session_id,
            "date": datetime.now().isoformat(),
            "conversation_transcript": request.conversation_transcript,
            "urgency_level": request.urgency_level.value,
            "risk_score": request.risk_score,
            "symptoms_found": request.symptoms_found,
            "recommendation": request.recommendation,
            "detected_from_image": request.detected_from_image,
            "image_url": request.image_url,
            "created_at": datetime.now(),
        }

        # Attempt to save to Firebase (optional)
        saved_to_firebase = False
        try:
            saved_to_firebase = firebase_manager.save_assessment(assessment_data)
        except Exception:
            saved_to_firebase = False

        # Local fallback: persist assessment to filesystem so PDF/history work without Firebase
        if not saved_to_firebase:
            ok = local_store.save_assessment(assessment_data)
            if not ok:
                print("Warning: local fallback save failed")

        pdf_payload = {
            "user_name": request.user_id,
            "date": datetime.now().isoformat(),
            "urgency_level": request.urgency_level,
            "risk_score": request.risk_score,
            "symptoms_found": request.symptoms_found,
            "detected_from_image": request.detected_from_image,
            "recommendation": request.recommendation,
            "conversation_transcript": request.conversation_transcript,
            "home_care_tips": [
                "Brush your teeth twice daily with a soft-bristled toothbrush",
                "Floss daily to remove plaque between teeth",
                "Use an antimicrobial mouthwash as recommended",
                "Avoid smoking and tobacco products",
                "Maintain a healthy diet low in sugar",
            ],
        }

        pdf_bytes = pdf_generator.generate_report(pdf_payload)
        pdf_url = ""

        try:
            import tempfile

            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                tmp_file.write(pdf_bytes)
                tmp_path = tmp_file.name

            pdf_url = firebase_manager.upload_image(
                tmp_path,
                f"assessments/{request.user_id}/{assessment_id}.pdf"
            )
            os.remove(tmp_path)
        except Exception as upload_error:
            print(f"Note: PDF upload to Firebase Storage failed: {upload_error}")
            pdf_url = ""

        ai_engine.end_session(request.session_id)

        return {
            "status": "saved",
            "assessment_id": assessment_id,
            "message": "Assessment saved successfully",
            "pdf_url": pdf_url,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving assessment: {str(e)}")


# ========== GET PDF REPORT ENDPOINT ==========
@app.get("/api/pdf/{assessment_id}", tags=["Assessment"])
async def get_assessment_pdf(assessment_id: str, user_id: str):
    """
    Generate and return a PDF report for a saved assessment.

    Parameters:
    - assessment_id: Assessment ID
    - user_id: User identifier

    Returns:
    - pdf_base64: PDF file encoded in hex string
    - filename: Suggested filename
    """
    try:
        # Try Firebase first
        assessment = None
        try:
            assessments = firebase_manager.get_user_assessments(user_id)
            assessment = next((a for a in assessments if a.get("assessment_id") == assessment_id), None)
        except Exception:
            assessment = None

        # If not found in Firebase, try local storage fallback
        if not assessment:
            assessment = local_store.get_assessment(assessment_id)

        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        try:
            pdf_bytes = pdf_generator.generate_report(assessment)
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")
        import base64

        return {
            "status": "success",
            "pdf_base64": base64.b64encode(pdf_bytes).decode('utf-8'),
            "filename": f"assessment_{assessment_id}.pdf",
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")


# ========== GET ASSESSMENT HISTORY ==========
@app.get("/api/history", tags=["History"])
async def get_history(user_id: str):
    """
    Get all past assessments for a user.
    
    Parameters:
    - user_id: User identifier
    
    Returns:
    - assessments: List of all assessments with details
    """
    try:
        # If Firebase is not configured, use local_store directly
        if getattr(firebase_manager, 'db', None) is None:
            assessments = local_store.list_assessments(user_id)
        else:
            try:
                assessments = firebase_manager.get_user_assessments(user_id)
                # if firebase returned nothing, fallback to local store
                if not assessments:
                    assessments = local_store.list_assessments(user_id)
            except Exception:
                assessments = local_store.list_assessments(user_id)

        return {
            "user_id": user_id,
            "total_assessments": len(assessments),
            "assessments": assessments,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching history: {str(e)}")


# ========== COMBINED IMAGE + CLINICAL ASSESSMENT ENDPOINT ==========
@app.post("/api/image-combined", tags=["Assessment"])
async def combined_assessment(
    file: UploadFile = File(...),
    session_id: str = None,
    clinical_symptoms: str = None,
):
    """
    Combine image analysis with reported clinical symptoms.

    This integrates visual findings with user-reported symptoms
    for a comprehensive risk assessment.

    Parameters:
    - file: Image file
    - session_id: Current session ID
    - clinical_symptoms: JSON string of reported symptoms

    Returns:
    - combined_risk_score: Integrated risk assessment
    - all_symptoms: Combined list of visual + clinical symptoms
    """
    try:
        # Analyze the image
        contents = await file.read()
        analysis_result = image_analyzer.analyze_image(contents)

        if analysis_result["status"] != "success":
            raise HTTPException(status_code=400, detail=analysis_result["message"])

        analysis = analysis_result["analysis"]

        # Parse clinical symptoms
        clinical_symptoms_list = []
        if clinical_symptoms:
            try:
                import json

                clinical_symptoms_list = json.loads(clinical_symptoms)
            except:
                clinical_symptoms_list = []

        # Get combined assessment
        combined = image_analyzer.get_combined_assessment(
            analysis["visual_risk_score"],
            analysis["symptoms_from_image"],
            clinical_symptoms_list,
        )

        return {
            "status": "success",
            "visual_risk_score": combined["visual_contribution"],
            "clinical_symptoms_count": combined["clinical_contribution"],
            "combined_risk_score": combined["combined_risk_score"],
            "all_symptoms": combined["total_symptoms"],
            "image_findings": analysis["visual_findings"],
            "recommendations": analysis["recommendations"],
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error in combined assessment: {str(e)}"
        )


# ========== HELPER FUNCTIONS ==========
def basic_image_analysis(image_data: bytes) -> str:
    """
    Deprecated: Use ImageAnalyzer class instead.
    
    This was the basic placeholder from Step 1.
    Now replaced with comprehensive image_analyzer module.
    """
    # This function is kept for backwards compatibility
    # but delegates to the proper ImageAnalyzer
    result = image_analyzer.analyze_image(image_data)
    if result["status"] == "success":
        return result["analysis"]["detailed_description"]
    return "Image analysis failed"


# ========== MAIN ENTRY POINT ==========
if __name__ == "__main__":
    import uvicorn

    # Run the FastAPI server
    uvicorn.run(
        app,
        host="0.0.0.0",  # Listen on all network interfaces
        port=8000,  # Port number
        log_level="info",
    )
