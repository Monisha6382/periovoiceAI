"""
Firebase Configuration for PerioVoice AI.
Handles connection to Firebase Firestore and Authentication.

Note: You'll need to:
1. Create a Firebase project at https://console.firebase.google.com
2. Download your service account JSON
3. Set the path in the GOOGLE_APPLICATION_CREDENTIALS environment variable
"""

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from firebase_admin import storage
import os


class FirebaseManager:
    """
    Manages all Firebase operations including database and storage.
    """

    def __init__(self):
        """Initialize Firebase connection."""
        self.db = None
        self.storage_bucket = None
        self.initialize_firebase()

    def initialize_firebase(self):
        """
        Initialize Firebase Admin SDK.
        Credentials and optional bucket settings are read from environment variables.
        """
        try:
            # Firebase configuration from environment
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            project_id = os.getenv("FIREBASE_PROJECT_ID")
            storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET")

            if not firebase_admin._apps:
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred, options={
                        "projectId": project_id,
                        "storageBucket": storage_bucket,
                    })
                else:
                    # If no service account file is explicitly provided, try application default credentials
                    firebase_admin.initialize_app(options={
                        "projectId": project_id,
                        "storageBucket": storage_bucket,
                    })

            self.db = firestore.client()
            if storage_bucket:
                self.storage_bucket = storage.bucket(storage_bucket)
            else:
                self.storage_bucket = storage.bucket()

            print("✅ Firebase initialized successfully")
            if self.storage_bucket:
                print(f"✅ Firebase storage bucket configured: {self.storage_bucket.name}")

        except Exception as e:
            print(f"⚠️ Firebase initialization failed: {e}")
            print("The app will work but won't save data to Firestore or Storage.")

    def save_user(self, user_id: str, user_data: dict) -> bool:
        """Save user data to Firestore."""
        try:
            if self.db is None:
                return False
            self.db.collection("users").document(user_id).set(user_data, merge=True)
            return True
        except Exception as e:
            print(f"Error saving user: {e}")
            return False

    def get_user(self, user_id: str) -> dict:
        """Retrieve user data from Firestore."""
        try:
            if self.db is None:
                return {}
            doc = self.db.collection("users").document(user_id).get()
            return doc.to_dict() if doc.exists else {}
        except Exception as e:
            print(f"Error getting user: {e}")
            return {}

    def save_assessment(self, assessment_data: dict) -> bool:
        """
        Save an assessment to Firestore.
        assessment_data should contain all assessment details.
        """
        try:
            if self.db is None:
                return False
            self.db.collection("assessments").add(assessment_data)
            return True
        except Exception as e:
            print(f"Error saving assessment: {e}")
            return False

    def get_user_assessments(self, user_id: str) -> list:
        """Get all assessments for a specific user."""
        try:
            if self.db is None:
                return []
            docs = (
                self.db.collection("assessments")
                .where("user_id", "==", user_id)
                .order_by("date", direction=firestore.Query.DESCENDING)
                .stream()
            )
            assessments = [doc.to_dict() for doc in docs]
            return assessments
        except Exception as e:
            print(f"Error getting assessments: {e}")
            return []

    def upload_image(self, file_path: str, destination_path: str) -> str:
        """
        Upload an image to Firebase Storage.
        Returns the download URL.
        """
        try:
            if self.storage_bucket is None:
                return ""
            blob = self.storage_bucket.blob(destination_path)
            blob.upload_from_filename(file_path)
            blob.make_public()
            return blob.public_url
        except Exception as e:
            print(f"Error uploading image: {e}")
            return ""

    def delete_assessment(self, assessment_id: str) -> bool:
        """Delete an assessment from Firestore."""
        try:
            if self.db is None:
                return False
            self.db.collection("assessments").document(assessment_id).delete()
            return True
        except Exception as e:
            print(f"Error deleting assessment: {e}")
            return False


# Create a global Firebase manager instance
firebase_manager = FirebaseManager()
