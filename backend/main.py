"""
PerioVoice AI™ - Backend API
FastAPI server for conversational periodontal triage and symptom assessment.
Powered by an Adaptive Triage State Engine (No LLM / No API keys).
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uuid
from datetime import datetime
import os
import sys
from dotenv import load_dotenv

# Guarantee root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import (
    ChatMessage,
    ChatResponse,
    SaveAssessmentRequest,
    AssessmentResult,
)
from backend.triage_state_engine import triage_state_engine
from backend.image_analyzer import image_analyzer
from backend.pdf_generator import pdf_generator
from backend import local_store
from backend import llm_client
from backend.firebase_config import firebase_manager

# Load .env in current directory and fallback to absolute backend subfolder path
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 PerioVoice AI Backend Starting (Adaptive Triage State Engine Mode)...")
    print("📱 Offline Clinical Triage Ready - Zero Third-Party API Key Dependencies")
    yield
    print("🛑 Shutting down...")

app = FastAPI(
    title="PerioVoice AI™ Backend",
    description="Adaptive Conversational System for Periodontal Symptom Assessment",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https://.*|http://localhost:.*|http://127.0.0.1:.*|http://192.168.1.13:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "engine_mode": "adaptive_triage_state_machine",
        "service": "PerioVoice AI Backend",
        "timestamp": datetime.now().isoformat(),
    }

@app.get("/api/firebase/health", tags=["Health"])
async def firebase_health_check():
    return firebase_manager.get_health_status()

@app.post("/api/start", tags=["Assessment"])
async def start_assessment(user_id: str):
    try:
        session_id, greeting, first_q = triage_state_engine.start_session(user_id)
        return {
            "session_id": session_id,
            "greeting": greeting,
            "first_question": first_q,
            "status": "session_started",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting session: {str(e)}")

@app.post("/analyze/text", response_model=ChatResponse, tags=["Assessment"])
@app.post("/api/chat", response_model=ChatResponse, tags=["Assessment"])
async def chat(message: ChatMessage):
    try:
        res = triage_state_engine.process_chat_message(message.session_id, message.message)
        
        final_result = None
        if res["is_assessment_complete"] and res["final_result"]:
            r = res["final_result"]
            final_result = AssessmentResult(
                urgency_level=r["urgency"],
                risk_score=r["risk_score"],
                symptoms_found=r["symptoms"],
                detected_from_image=None,
                recommendation=r["recommendation"],
                home_care_tips=r["home_care_tips"],
                should_see_dentist=r["should_see_dentist"],
                urgency=r["urgency"],
                symptoms=r["symptoms"],
                location=r.get("location", "Oral Cavity"),
                duration=r.get("duration", "Not specified"),
                condition_category=r.get("condition_category", "Periodontal Assessment"),
                condition_description=r.get("condition_description", ""),
                urgency_rationale=r.get("urgency_rationale", "")
            )
            
            # Auto-save completed assessment to BOTH Firestore and Local Storage
            try:
                auto_data = {
                    "assessment_id": message.session_id,
                    "user_id": message.user_id,
                    "user_name": "Guest Patient" if message.user_id == "guest_patient" else message.user_id,
                    "session_id": message.session_id,
                    "conversation_transcript": res["conversation_transcript"],
                    "urgency_level": r["urgency"],
                    "risk_score": r["risk_score"],
                    "symptoms_found": r["symptoms"],
                    "recommendation": r["recommendation"],
                    "home_care_tips": r["home_care_tips"],
                    "detected_from_image": None,
                    "created_at": datetime.now().isoformat(),
                    "date": datetime.now().strftime("%Y-%m-%d")
                }
                
                # Primary: Firestore Save
                firebase_saved = False
                try:
                    firebase_saved = firebase_manager.save_assessment(auto_data)
                except Exception as fe:
                    print(f"🔥 Auto-save Firestore notice: {fe}")
                
                # Backup: Local Storage Save
                local_saved = local_store.save_assessment(auto_data)
                auto_data["synced"] = firebase_saved
            except Exception as e:
                print(f"Auto-save error: {e}")

        return ChatResponse(
            response=res["response"],
            session_id=message.session_id or "",
            is_assessment_complete=res["is_assessment_complete"],
            next_question="",
            final_result=final_result,
            conversation_transcript=res["conversation_transcript"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Request

@app.post("/analyze/image", response_model=ChatResponse, tags=["Assessment"])
@app.post("/api/image", tags=["Assessment"])
async def analyze_image_endpoint(request: Request, file: Optional[UploadFile] = File(None), session_id: Optional[str] = None):
    try:
        contents = None
        if file:
            try:
                contents = await file.read()
            except Exception:
                contents = None

        if not contents:
            body = await request.body()
            if body:
                if b"base64," in body[:120]:
                    import base64
                    data_str = body.decode("utf-8", errors="ignore").split("base64,", 1)[-1]
                    contents = base64.b64decode(data_str)
                else:
                    contents = body

        if not contents:
            raise HTTPException(status_code=400, detail="No valid image payload received.")

        res = image_analyzer.analyze_image(contents)
        
        # Check if non-dental photo was rejected
        if res.get("status") == "error" or res.get("is_dental") is False:
            err_msg = res.get("message", "⚠️ This image does not appear to be a dental or oral photo. Please upload a clear photo of your teeth, gums, or mouth area for assessment.")
            return ChatResponse(
                response=err_msg,
                session_id=session_id or "",
                is_assessment_complete=False,
                next_question="",
                final_result=None,
                conversation_transcript=[]
            )

        # Valid dental image detected: format visual findings & merge detected tags into session state
        findings_list = res.get("findings", [])
        detected_tags = res.get("detected_symptom_tags", [])

        if session_id and session_id in triage_state_engine.sessions:
            session = triage_state_engine.sessions[session_id]
            for tag in detected_tags:
                session["matched_symptom_keys"].add(tag)
            transcript = session.get("transcript", [])
        else:
            transcript = []

        # Generate visual findings + continuation question using LLM
        llm_reply = llm_client.query_llm_image_continuation(findings_list, res.get("recommendation", ""), transcript)
        
        if not llm_reply:
            findings_text = "\n".join(findings_list) if findings_list else "Visual inspection shows localized tissue variation."
            llm_reply = (
                f"📷 **Dental Photo Scanned:**\n{findings_text}\n\n"
                "Next question: How long have you been experiencing discomfort or changes in this area?"
            )

        if session_id and session_id in triage_state_engine.sessions:
            session["transcript"].append({"sender": "bot", "text": llm_reply})
            session["last_asked"] = "duration"

        return ChatResponse(
            response=llm_reply,
            session_id=session_id or "",
            is_assessment_complete=False,
            next_question="",
            final_result=None,
            conversation_transcript=session.get("transcript", []) if session_id and session_id in triage_state_engine.sessions else []
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image analysis error: {str(e)}")

@app.post("/api/save", tags=["Assessment"])
async def save_assessment(req: SaveAssessmentRequest):
    try:
        data = req.dict()
        data["assessment_id"] = req.session_id
        data["user_name"] = req.user_id
        if "created_at" not in data:
            data["created_at"] = datetime.now().isoformat()
        if "date" not in data:
            data["date"] = datetime.now().strftime("%Y-%m-%d")
        
        # Primary: Save to Firestore
        firebase_saved = False
        try:
            firebase_saved = firebase_manager.save_assessment(data)
        except Exception as fe:
            print(f"🔥 Firestore save error: {fe}")
            
        # Backup: Save to local storage
        local_saved = local_store.save_assessment(data)
        
        if firebase_saved:
            return {
                "status": "success",
                "assessment_id": req.session_id,
                "firebase_saved": True,
                "local_saved": local_saved,
                "synced": True
            }
        else:
            return {
                "status": "saved_locally",
                "assessment_id": req.session_id,
                "firebase_saved": False,
                "local_saved": local_saved,
                "synced": False
            }
    except Exception as e:
        return {
            "status": "saved_locally",
            "assessment_id": req.session_id,
            "firebase_saved": False,
            "local_saved": True,
            "synced": False
        }

@app.get("/api/history", tags=["Assessment"])
async def get_history(user_id: str):
    try:
        # Try fetching from Firestore first
        assessments = firebase_manager.get_user_assessments(user_id)
        if assessments:
            return assessments
    except Exception as fe:
        print(f"Firestore history fetch error: {fe}")
        
    # Fallback to local storage
    try:
        return local_store.list_assessments(user_id)
    except Exception as e:
        return []

@app.delete("/api/assessment/{assessment_id}", tags=["Assessment"])
async def delete_assessment(assessment_id: str):
    try:
        local_store.delete_assessment(assessment_id)
        firebase_manager.delete_assessment(assessment_id)
        return {"status": "deleted"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.get("/api/user/{uid}", tags=["User"])
async def get_user_profile(uid: str):
    try:
        data = firebase_manager.get_user(uid)
        return data or {}
    except Exception:
        return {}

@app.put("/api/user/{uid}", tags=["User"])
async def update_user_profile(uid: str, profile: dict):
    try:
        firebase_manager.save_user(uid, profile)
        return {"status": "updated"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.get("/api/pdf/{assessment_id}", tags=["Assessment"])
async def get_pdf_report(assessment_id: str, user_id: str):
    try:
        # Load assessment data first
        assessment_data = local_store.get_assessment(assessment_id)
        if not assessment_data:
            # Fallback to active triage session memory if not written to disk yet
            if assessment_id in triage_state_engine.sessions:
                sess = triage_state_engine.sessions[assessment_id]
                r = triage_state_engine.generate_final_assessment(sess["state"], sess["matched_symptom_keys"])
                assessment_data = {
                    "user_name": "Guest Patient" if sess.get("user_id") == "guest_patient" else sess.get("user_id", "N/A"),
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "urgency_level": r["urgency"],
                    "risk_score": r["risk_score"],
                    "symptoms_found": r["symptoms"],
                    "recommendation": r["recommendation"],
                    "home_care_tips": r["home_care_tips"],
                    "conversation_transcript": sess.get("transcript", []),
                    "detected_from_image": None
                }
        if not assessment_data:
            raise HTTPException(status_code=404, detail="Assessment report not found.")

        pdf_bytes = pdf_generator.generate_report(assessment_data)
        from fastapi.responses import Response
        return Response(content=pdf_bytes, media_type="application/pdf")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation error: {str(e)}")
