/**
 * api.js — All API calls to the PerioVoice FastAPI backend.
 * Change REACT_APP_BACKEND_URL in .env when deploying to Render.
 */
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BACKEND_URL, timeout: 30000 });

export const startSession    = (userId)          => api.post(`/api/start?user_id=${userId}`).then(r => r.data);
export const sendChat        = (payload)         => api.post("/api/chat", { user_id: payload.userId, message: payload.message, input_type: payload.inputType || "text", session_id: payload.sessionId }).then(r => r.data);
export const analyzeImage    = (file, sessionId) => { const fd = new FormData(); fd.append("file", file); if (sessionId) fd.append("session_id", sessionId); return api.post("/api/image", fd, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data); };
export const saveAssessment  = (payload)         => api.post("/api/save", payload).then(r => r.data);
export const getHistory      = (userId)          => api.get(`/api/history?user_id=${userId}`).then(r => r.data);
export const getPdf          = (aId, userId)     => api.get(`/api/pdf/${aId}?user_id=${userId}`).then(r => r.data);

export default api;
