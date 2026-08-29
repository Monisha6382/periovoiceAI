/**
 * api.js — Hybrid API Client for PerioVoice AI
 * Connects to FastAPI backend when online, falls back to ClientTriageEngine offline.
 */
import axios from "axios";
import { clientTriageEngine } from "../utils/triageEngine";

export const getBackendUrl = () => {
  const customUrl = localStorage.getItem("periovoice_backend_url");
  if (customUrl) return customUrl;
  
  // Detect if running inside Android Capacitor app or Android browser
  const isAndroid = (
    (typeof window !== "undefined" && window.Capacitor?.isNativePlatform()) ||
    (typeof window !== "undefined" && window.location.protocol === "capacitor:") ||
    (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent))
  );

  const envUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL;

  if (isAndroid) {
    // For native Android local testing, default to LAN IP (192.168.1.13:8000)
    // If REACT_APP_BACKEND_URL is configured and is NOT localhost, use it (for future production URL)
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }
    return "http://192.168.1.13:8000";
  }

  return envUrl || "http://localhost:8000";
};

const api = axios.create({ baseURL: getBackendUrl(), timeout: 8000 });

export const startSession = async (userId) => {
  try {
    const res = await api.post(`/api/start?user_id=${userId}`);
    return res.data;
  } catch (err) {
    console.warn("Backend API offline/unreachable on Android, using client-side Adaptive Triage Engine.");
    return clientTriageEngine.startSession(userId);
  }
};

export const sendChat = async (payload) => {
  try {
    const res = await api.post("/api/chat", {
      user_id: payload.userId,
      message: payload.message,
      input_type: payload.inputType || "text",
      session_id: payload.sessionId
    });
    return res.data;
  } catch (err) {
    console.warn("Backend API offline, executing client-side Adaptive Triage Engine.");
    const res = clientTriageEngine.processMessage(payload.sessionId, payload.message);
    return {
      response: res.response,
      session_id: payload.sessionId,
      is_assessment_complete: res.is_assessment_complete,
      next_question: "",
      final_result: res.final_result,
      conversation_transcript: res.conversation_transcript
    };
  }
};

export const analyzeImage = async (file, sessionId) => {
  const backendUrl = getBackendUrl();
  const url = sessionId ? `/analyze/image?session_id=${sessionId}` : "/analyze/image";
  const requestUrl = `${backendUrl}${url}`;

  console.log("[Image Upload] Initiating image analysis upload:", {
    backendUrl,
    requestEndpoint: url,
    fullRequestUrl: requestUrl,
    fileType: file?.type || "unknown",
    fileName: file?.name || "unknown",
    fileSize: file?.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "unknown",
    isBlob: file instanceof Blob,
    isFile: file instanceof File
  });

  try {
    const formData = new FormData();
    // Use the field name 'file' expected by the FastAPI backend
    formData.append("file", file, file.name || "image.jpg");

    // Let Axios generate the multipart/form-data boundary header automatically
    const res = await api.post(url, formData);

    console.log("[Image Upload] Upload success. Response details:", {
      status: res.status,
      statusText: res.statusText,
      data: res.data
    });

    return res.data;
  } catch (err) {
    console.error("[Image Upload] Error occurred during upload:", {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      statusText: err.response?.statusText,
      responseData: err.response?.data,
      config: {
        url: err.config?.url,
        baseURL: err.config?.baseURL,
        headers: err.config?.headers
      }
    });
    // Rethrow the error so calling components can catch it and display contextual user-friendly messages
    throw err;
  }
};

import { collection, query, where, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

export const getHistory = async (userId) => {
  const userKey = userId || "guest_patient";
  const userCacheKey = `periovoice_history_${userKey}`;
  let items = [];

  try {
    const res = await api.get(`/api/history?user_id=${userKey}`);
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      items = res.data;
    }
  } catch (err) {
    console.warn("Backend history API offline, falling back to Firestore & LocalStorage.");
  }

  // Sync with Firestore if user is authenticated
  if (userKey && !userKey.startsWith("guest")) {
    try {
      const q = query(
        collection(db, "assessments"),
        where("user_id", "==", userKey)
      );
      const snapshot = await getDocs(q);
      const firestoreItems = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      if (firestoreItems.length > 0) {
        const mergedMap = new Map();
        [...firestoreItems, ...items].forEach(item => {
          const k = item.id || item.session_id || item.created_at;
          if (k && !mergedMap.has(k)) {
            mergedMap.set(k, item);
          }
        });
        items = Array.from(mergedMap.values());
      }
    } catch (fsErr) {
      console.warn("Firestore history fetch error:", fsErr);
    }
  }

  if (!items || items.length === 0) {
    items = JSON.parse(localStorage.getItem(userCacheKey) || localStorage.getItem("periovoice_history") || "[]");
  }

  items.sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0));
  // Save user-isolated local cache
  localStorage.setItem(userCacheKey, JSON.stringify(items));
  return items;
};

export const saveAssessment = async (payload) => {
  const userKey = payload.user_id || "guest_patient";
  const userCacheKey = `periovoice_history_${userKey}`;
  const recordId = payload.session_id || payload.id || ('rec_' + Date.now());
  const recordToSave = {
    id: recordId,
    session_id: recordId,
    user_id: userKey,
    user_email: payload.user_email || "",
    created_at: payload.created_at || new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    urgency_level: (payload.urgency_level || payload.urgency || 'MODERATE').toUpperCase(),
    urgency: (payload.urgency_level || payload.urgency || 'MODERATE').toUpperCase(),
    risk_score: payload.risk_score || 4,
    symptoms_found: payload.symptoms_found || payload.symptoms || [],
    symptoms: payload.symptoms_found || payload.symptoms || [],
    recommendation: payload.recommendation || '',
    home_care_tips: payload.home_care_tips || []
  };

  // 1. User-isolated LocalStorage backup
  const existing = JSON.parse(localStorage.getItem(userCacheKey) || '[]');
  const updatedLocal = [recordToSave, ...existing.filter(i => i.id !== recordId && i.session_id !== recordId)];
  localStorage.setItem(userCacheKey, JSON.stringify(updatedLocal));

  // 2. Real-time Firestore sync across Web and Mobile partitioned by user email/id
  if (userKey && !userKey.startsWith("guest")) {
    try {
      await setDoc(doc(db, "assessments", recordId), recordToSave, { merge: true });
      console.log("✅ Synced user-isolated assessment record to Firestore!");
    } catch (e) {
      console.warn("Firestore assessment sync notice:", e);
    }
  }

  // 3. FastAPI server backup
  try {
    const res = await api.post("/api/save", payload);
    return res.data;
  } catch (err) {
    return true;
  }
};

export const getPdf = async (sessionId, userId) => {
  try {
    const res = await api.get(`/api/pdf/${sessionId}?user_id=${userId}`, {
      responseType: "blob"
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `periovoice_report_${sessionId.substring(0, 8)}.pdf`;
    link.click();
    return true;
  } catch (err) {
    console.warn("PDF API error:", err);
    return false;
  }
};

export const deleteAssessment = async (sessionId) => {
  try {
    const res = await api.delete(`/api/assessment/${sessionId}`);
    return res.data;
  } catch (err) {
    console.warn("Delete API error:", err);
    return false;
  }
};
