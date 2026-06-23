# PerioVoice AI™ Backend

## 📋 Overview

This is the FastAPI backend for PerioVoice AI - an AI-driven conversational system for periodontal symptom assessment.

### What's Included in Step 1:

1. **main.py** - FastAPI server with all API endpoints
2. **ai_engine.py** - Core AI conversation logic
3. **models.py** - Pydantic data models for type safety
4. **firebase_config.py** - Firebase Firestore connection setup
5. **test_ai.py** - Testing script to verify AI logic
6. **requirements.txt** - Python dependencies
7. **.env.example** - Environment configuration template

---

## 🚀 Getting Started

### 1. Install Python (if not already installed)
- Download from https://www.python.org/downloads/
- Make sure to check "Add Python to PATH" during installation

### 2. Create a Virtual Environment

```bash
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the Test Script

Before running the server, test the AI logic:

```bash
python test_ai.py
```

You should see output showing a complete conversation with urgency assessment.

### 5. Run the Backend Server

From the repository root:

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

The server will start at `http://localhost:8000`

You can access the interactive API documentation at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns: Server status

### Start Assessment
```
POST /api/start?user_id=YOUR_USER_ID
```
Returns: Session ID and first question

### Send Chat Message
```
POST /api/chat
Body: {
  "user_id": "user_001",
  "message": "I have pain in my gums",
  "input_type": "text",
  "session_id": "session-uuid"
}
```
Returns: AI response and next question

### Analyze Image
```
POST /api/image
Body: form-data with "file" (image) and optional "session_id"
```
Returns: Image analysis description

### Save Assessment
```
POST /api/save
Body: Complete assessment details
```
Returns: Assessment ID

### Get Assessment History
```
GET /api/history?user_id=YOUR_USER_ID
```
Returns: All past assessments for the user

---

## 🧠 How the AI Works

### Question Flow
The AI asks 7 follow-up questions:
1. Where is the pain?
2. How long have you had this?
3. Pain level (1-10)?
4. Do gums bleed when brushing?
5. Any swelling, pus, or bad taste?
6. Any loose teeth?
7. Last dental visit?

### Urgency Scoring System
Each symptom adds points to the risk score (1-10):
- **Severe pain (8-10)**: +4 points
- **Bleeding gums**: +3 points
- **Swelling/pus/bad taste**: +3 points
- **Loose teeth**: +4 points
- **Chronic duration**: +2 points

### Urgency Levels
- **EMERGENCY (9-10)**: 🚨 Go immediately
- **HIGH (7-8)**: 🔴 See dentist within 48 hours
- **MODERATE (4-6)**: 🟡 See dentist within 1-2 weeks
- **LOW (1-3)**: 🟢 Home care is enough

---

## 🔐 Firebase Setup (Optional for Step 1)

If you want to test with Firebase:

1. Create a Firebase project at https://console.firebase.google.com
2. Download a service account JSON key from Project Settings
3. Copy `backend/.env.example` to `backend/.env`
4. Set these values in `backend/.env`:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\firebase-credentials.json
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   ```
5. Reload your shell or restart the backend after setting the env vars.

On PowerShell:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\your\firebase-credentials.json"
$env:FIREBASE_PROJECT_ID = "your-firebase-project-id"
$env:FIREBASE_STORAGE_BUCKET = "your-project.appspot.com"
```

On macOS/Linux:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-credentials.json"
export FIREBASE_PROJECT_ID="your-firebase-project-id"
export FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
```

Then start the backend normally:
```bash
python main.py
```

**Note:** Firebase is optional. The app works without it for local testing, but Firestore saves and PDF upload to Storage require credentials.

### Local storage fallback

If Firebase credentials are not provided, the backend will still save assessments locally to `backend/local_storage/assessments/`.
This allows the `/api/history` and `/api/pdf/{assessment_id}` endpoints to work without Firebase configured.

To clear local data, remove files from `backend/local_storage/assessments/`.

## LLM Comparison Support

This backend now supports an optional LLM-based comparison flow alongside the existing rule-based engine.

Environment variables:
- `OPENAI_API_KEY` – required to enable the LLM.
- `OPENAI_MODEL` – optional, defaults to `gpt-4o-mini`.

New API endpoints:
- `POST /api/llm-chat` — query the LLM for a response using the current session context.
- `POST /api/compare-chat` — compare the rule-based response and the LLM response for the same user message.

If `OPENAI_API_KEY` is not set, the endpoints still work but will return a fallback LLM message explaining that the LLM is not configured.
---

## 📝 File Descriptions

### main.py
- FastAPI server setup
- CORS middleware for frontend access
- All 6 API endpoints
- Request validation using Pydantic models

### ai_engine.py
- `PeriovoiceAIEngine` class - core AI logic
- Conversation flow management
- Symptom extraction from responses
- Risk score calculation
- Urgency level determination
- Recommendation generation

### models.py
- `ChatMessage` - user input
- `ChatResponse` - AI output
- `AssessmentResult` - final result
- `UrgencyLevel` enum
- Other data structures

### firebase_config.py
- Firebase Admin SDK initialization
- Firestore database operations
- Methods: save_user, get_user, save_assessment, etc.
- Error handling and logging

### test_ai.py
- Tests complete conversation flow
- Tests different severity levels
- Verifies urgency calculations
- Useful for debugging

---

## 🐛 Troubleshooting

### "ModuleNotFoundError: No module named 'fastapi'"
```bash
pip install -r requirements.txt
```

### "Address already in use" on port 8000
Another app is using port 8000. Change port in main.py:
```python
uvicorn.run(app, host="0.0.0.0", port=8001)
```

### CORS errors when connecting from frontend
CORS is already configured. Make sure your frontend URL is in the allowed origins list.

---

## ✅ Testing with cURL

Test the health endpoint:
```bash
curl http://localhost:8000/health
```

Start a session:
```bash
curl -X POST "http://localhost:8000/api/start?user_id=user_001"
```

Send a chat message:
```bash
curl -X POST "http://localhost:8000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "message": "I have pain in my lower gums",
    "input_type": "text",
    "session_id": "your-session-id"
  }'
```

---

## 📚 Next Steps

After Step 1 is complete and tested:

- **Step 2:** Test AI conversation extensively
- **Step 3:** Add image upload and analysis
- **Step 4:** Build React web frontend
- **Step 5:** Build result visualization
- **Step 6+:** Mobile (Flutter) and advanced features

---

## 💡 Key Concepts

### Session Management
- Each user starts a unique session
- AI remembers all previous responses in the session
- Session data can be saved to database

### Urgency Assessment
- Based on symptom combination, not individual symptom
- Risk score is objective (1-10)
- Multiple emergency indicators trigger EMERGENCY level

### Scalability
- FastAPI is lightweight and fast
- Ready for production with uvicorn/gunicorn
- Can handle concurrent requests
- Firebase scales automatically

---

## 📄 License

PerioVoice AI™ - Final Year University Project

---

**Happy coding! 🚀**
