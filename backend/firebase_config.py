"""
firebase_config.py — PerioVoice AI™ Firebase Manager
Handles connections to Firebase Admin SDK, Firestore database, and Cloud Storage.
Supports robust credential resolution, idempotent document saves, health checks, and local fallback logging.
"""

import os
import json
from datetime import datetime
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, storage

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)


class FirebaseManager:
    """
    Manages all Firebase operations including database and storage.
    """

    def __init__(self):
        self.db = None
        self.storage_bucket = None
        self.project_id = None
        self.is_initialized = False
        self.initialize_firebase()

    def _resolve_cred_path(self) -> str:
        """Robustly resolve the path to firebase-key.json across environments."""
        # Check if raw service account JSON string is provided in environment variables (for PaaS like Render)
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if service_account_json:
            try:
                cred_dict = json.loads(service_account_json.strip())
                temp_path = os.path.join(BASE_DIR, "firebase-key-temp.json")
                with open(temp_path, "w") as f:
                    json.dump(cred_dict, f)
                print("🔥 Decoded Firebase credentials from FIREBASE_SERVICE_ACCOUNT_JSON environment variable.")
                return temp_path
            except Exception as e:
                print(f"⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}")

        env_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        candidate_paths = []

        if env_path:
            candidate_paths.append(env_path)
            candidate_paths.append(os.path.join(BASE_DIR, env_path))
            candidate_paths.append(os.path.join(PROJECT_ROOT, env_path))

        candidate_paths.extend([
            os.path.join(BASE_DIR, "firebase-key.json"),
            os.path.join(PROJECT_ROOT, "firebase-key.json"),
            os.path.join(os.getcwd(), "firebase-key.json"),
            os.path.join(os.getcwd(), "backend", "firebase-key.json")
        ])

        for path in candidate_paths:
            if path and os.path.exists(path):
                return os.path.abspath(path)
        return ""

    def initialize_firebase(self):
        """
        Initialize Firebase Admin SDK with visible startup logging.
        """
        try:
            cred_path = self._resolve_cred_path()
            project_id = os.getenv("FIREBASE_PROJECT_ID", "periovoiceai")
            storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET", "periovoiceai.firebasestorage.app")
            self.project_id = project_id

            if not firebase_admin._apps:
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred, options={
                        "projectId": project_id,
                        "storageBucket": storage_bucket,
                    })
                else:
                    # Attempt application default credentials fallback
                    firebase_admin.initialize_app(options={
                        "projectId": project_id,
                        "storageBucket": storage_bucket,
                    })

            self.db = firestore.client()
            try:
                self.storage_bucket = storage.bucket(storage_bucket) if storage_bucket else storage.bucket()
            except Exception:
                self.storage_bucket = None

            self.is_initialized = True
            print("\n==================================================")
            print("🔥 Firebase Initialized Successfully")
            print(f"📌 Project ID: {project_id}")
            print("⚡ Firestore: CONNECTED")
            if self.storage_bucket:
                print(f"📦 Storage Bucket: {self.storage_bucket.name}")
            print("==================================================\n")

        except Exception as e:
            self.is_initialized = False
            print("\n==================================================")
            print("⚠️ Firebase initialization FAILED")
            print(f"Reason: {str(e)}")
            print("Firestore writes will NOT be available (local storage fallback active).")
            print("==================================================\n")

    def get_health_status(self) -> dict:
        """Returns non-sensitive health and connection status for /api/firebase/health."""
        return {
            "firebase_initialized": self.is_initialized and self.db is not None,
            "firestore_connected": self.db is not None,
            "storage_configured": self.storage_bucket is not None,
            "project_id": self.project_id or "periovoiceai"
        }

    def save_user(self, user_id: str, user_data: dict) -> bool:
        """Save user profile data to Firestore document users/<user_id> with merge=True."""
        try:
            if not self.db:
                return False
            user_data["updated_at"] = datetime.now().isoformat()
            self.db.collection("users").document(str(user_id)).set(user_data, merge=True)
            return True
        except Exception as e:
            print(f"🔥 Error saving user to Firestore: {e}")
            return False

    def get_user(self, user_id: str) -> dict:
        """Retrieve user profile data from Firestore document users/<user_id>."""
        try:
            if not self.db:
                return {}
            doc = self.db.collection("users").document(str(user_id)).get()
            return doc.to_dict() if doc.exists else {}
        except Exception as e:
            print(f"🔥 Error getting user from Firestore: {e}")
            return {}

    def save_assessment(self, assessment_data: dict) -> bool:
        """
        Save an assessment to Firestore collection 'assessments' using idempotent document ID.
        """
        try:
            if not self.db:
                return False
            
            doc_id = (
                assessment_data.get("assessment_id") or
                assessment_data.get("session_id") or
                assessment_data.get("id")
            )
            
            # Standardize timestamp fields
            now_iso = datetime.now().isoformat()
            now_date = datetime.now().strftime("%Y-%m-%d")
            
            payload = dict(assessment_data)
            if "created_at" not in payload:
                payload["created_at"] = now_iso
            if "date" not in payload:
                payload["date"] = now_date
            payload["synced"] = True

            if doc_id:
                self.db.collection("assessments").document(str(doc_id)).set(payload, merge=True)
            else:
                self.db.collection("assessments").add(payload)
                
            print(f"🔥 Assessment successfully written to Firestore: {doc_id}")
            return True
        except Exception as e:
            print(f"🔥 Error saving assessment to Firestore: {e}")
            return False

    def get_user_assessments(self, user_id: str) -> list:
        """Get all assessments for a specific user from Firestore."""
        try:
            if not self.db:
                return []
            
            # Primary query: ordered stream
            try:
                docs = (
                    self.db.collection("assessments")
                    .where("user_id", "==", user_id)
                    .order_by("created_at", direction=firestore.Query.DESCENDING)
                    .stream()
                )
                assessments = [doc.to_dict() for doc in docs]
                if assessments:
                    return assessments
            except Exception:
                pass

            # Fallback query without composite index requirement
            docs = self.db.collection("assessments").where("user_id", "==", user_id).stream()
            assessments = [doc.to_dict() for doc in docs]
            assessments.sort(key=lambda x: x.get("created_at") or x.get("date") or "", reverse=True)
            return assessments
        except Exception as e:
            print(f"🔥 Error getting assessments from Firestore: {e}")
            return []

    def upload_image(self, file_path: str, destination_path: str) -> str:
        """
        Upload an image file to Firebase Storage. Returns the blob path.
        """
        try:
            if not self.storage_bucket:
                return ""
            blob = self.storage_bucket.blob(destination_path)
            blob.upload_from_filename(file_path)
            return blob.name
        except Exception as e:
            print(f"🔥 Error uploading image to Firebase Storage: {e}")
            return ""

    def delete_assessment(self, assessment_id: str) -> bool:
        """Delete an assessment document from Firestore."""
        try:
            if not self.db:
                return False
            self.db.collection("assessments").document(str(assessment_id)).delete()
            return True
        except Exception as e:
            print(f"🔥 Error deleting assessment from Firestore: {e}")
            return False


# Global singleton instance
firebase_manager = FirebaseManager()
