import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import VoiceButton from "../components/VoiceButton";
import ImageUpload from "../components/ImageUpload";
import ChatBubble from "../components/ChatBubble";
import { startSession, sendChat, analyzeImage, saveAssessment } from "../services/api";
import { translations } from "../utils/translations";
import { Send, ArrowLeft, Stethoscope, Sparkles } from "../components/Icons";
import "./Chat.css";

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lang] = useState(localStorage.getItem('language') || 'en');
  const t = translations[lang] || translations.en;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      initSession();
    }
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const addMessage = (text, isUser, extra = {}) => {
    setMessages(prev => [...prev, { text, isUser, timestamp: new Date().toISOString(), ...extra }]);
  };

  const initSession = async () => {
    setLoading(true);
    const userId = user?.uid || "guest_patient";
    const data = await startSession(userId);
    setSessionId(data.session_id);
    
    const greetingText = lang === 'ta' 
      ? "வணக்கம்! 👋 நான் பெரியோவாய்ஸ் AI, உங்கள் பல் மற்றும் ஈறு சுகாதார உதவியாளர். உங்கள் அறிகுறிகளை விவரிக்கவும்."
      : (data.greeting || "Hello! 👋 I am PerioVoice AI™, your dental and gum health triage assistant. Describe your symptoms to begin.");

    addMessage(greetingText, false);
    setLoading(false);
  };

  const saveAssessmentToHistory = (finalResult, sid) => {
    if (!finalResult) return;
    const userId = user?.uid || "guest_patient";
    const recId = sid || 'rec_' + Date.now();
    const existing = JSON.parse(localStorage.getItem('periovoice_history') || '[]');
    const newRecord = {
      id: recId,
      session_id: recId,
      created_at: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      risk_score: finalResult.risk_score || 4,
      urgency_level: finalResult.urgency_level || finalResult.urgency || 'MODERATE',
      symptoms: finalResult.symptoms_found || finalResult.symptoms || [],
      symptoms_found: finalResult.symptoms_found || finalResult.symptoms || [],
      recommendation: finalResult.recommendation || '',
      home_care_tips: finalResult.home_care_tips || []
    };
    localStorage.setItem('periovoice_history', JSON.stringify([newRecord, ...existing]));

    // Send payload to backend server /api/save
    saveAssessment({
      user_id: userId,
      session_id: recId,
      conversation_transcript: messages.map(m => ({ sender: m.isUser ? "user" : "bot", text: m.text })),
      urgency_level: (finalResult.urgency_level || finalResult.urgency || 'MODERATE').toUpperCase(),
      risk_score: finalResult.risk_score || 4,
      symptoms_found: finalResult.symptoms_found || finalResult.symptoms || [],
      recommendation: finalResult.recommendation || ''
    });
  };

  const [completedResult, setCompletedResult] = useState(null);

  const goToReport = (resultData) => {
    const resToUse = resultData || completedResult;
    if (!resToUse) return;
    navigate('/result', {
      state: {
        result: resToUse,
        sessionId,
        userId: user?.uid || "guest_patient"
      }
    });
  };

  const processMessage = async (userText) => {
    const cleanedText = userText.toLowerCase().trim();

    // If user says yes/summarize/report after completion, open full report
    if (completedResult && (
      ["yes", "yeah", "sure", "ok", "okay", "summarize", "report", "view report", "show report", "yes please", "view"].some(w => cleanedText.includes(w))
    )) {
      goToReport(completedResult);
      return;
    }

    setLoading(true);
    setIsTyping(true);

    try {
      const payload = {
        userId: user?.uid || "guest_patient",
        message: userText,
        sessionId
      };

      const res = await sendChat(payload);
      await new Promise(resolve => setTimeout(resolve, 600));
      setIsTyping(false);

      if (res.response) {
        addMessage(res.response, false);
      }

      if (res.is_assessment_complete && res.final_result) {
        setCompletedResult(res.final_result);
        saveAssessmentToHistory(res.final_result, sessionId);
      }
    } catch (err) {
      // Use offline triage engine as fallback
      try {
        const { clientTriageEngine } = await import('../utils/triageEngine');
        const offlineRes = clientTriageEngine.processMessage(sessionId, userText);
        await new Promise(resolve => setTimeout(resolve, 600));
        setIsTyping(false);
        if (offlineRes.response) {
          addMessage(offlineRes.response, false);
        }
        if (offlineRes.is_assessment_complete && offlineRes.final_result) {
          setCompletedResult(offlineRes.final_result);
          saveAssessmentToHistory(offlineRes.final_result, sessionId);
        }
      } catch (fallbackErr) {
        setIsTyping(false);
        addMessage("I'm having trouble connecting right now. Could you try describing your symptoms again?", false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (customText = null) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || loading) return;
    setInputText("");
    addMessage(textToSend.trim(), true);
    await processMessage(textToSend.trim());
  };

  const handleVoiceTranscript = (transcript) => {
    setInputText(transcript);
    inputRef.current?.focus();
  };

  const handleImageSelected = async (file) => {
    if (!file) return;

    try {
      setLoading(true);

      // Convert to base64 for safe rendering in Android WebView (avoids blob URL security blocks)
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Url = reader.result;

        addMessage("📷 Uploaded dental photo for assessment", true, {
          isImage: true,
          imageUrl: base64Url,
        });

        addMessage(t.analyzingImage || "Analyzing image...", false, { isLoading: true });
        
        try {
          const res = await analyzeImage(file, sessionId);

          // Remove typing bubble
          setMessages(prev => prev.filter(m => !m.isLoading));

          const replyMsg = res.response || res.text || res.message;
          if (replyMsg) {
            addMessage(replyMsg, false);
          }

          if (res.is_assessment_complete || res.isComplete) {
            const finalResult = res.final_result || {
              risk_score: res.riskScore || 5,
              urgency_level: res.urgency || "MODERATE",
              symptoms_found: res.symptoms || ["Dental Finding"],
              recommendation: res.recommendation || "",
              home_care_tips: res.homeCareTips || []
            };
            setCompletedResult(finalResult);
            saveAssessmentToHistory(finalResult, sessionId);
          }
        } catch (err) {
          setMessages(prev => prev.filter(m => !m.isLoading));
          const status = err?.response?.status;
          if (status === 503) {
            addMessage("⚠️ Image analysis model is not yet loaded on the server. Please describe your symptoms in text instead.", false);
          } else {
            addMessage("⚠️ Photo received, but automated visual assessment is offline. Please describe your symptoms in text.", false);
          }
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setLoading(false);
      console.error("Error loading image file:", err);
    }
  };

  return (
    <div className="chat-container">
      {/* Messages Scroll Area */}

      {/* Messages Scroll Area */}
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <ChatBubble key={index} message={msg} />
        ))}

        {isTyping && (
          <div className="typing-indicator-bubble">
            <Sparkles size={16} color="var(--accent-cyan)" className="spin-icon" />
            <span>AI is evaluating symptoms...</span>
          </div>
        )}

        {completedResult && (
          <div className="report-action-banner" style={{ margin: "16px 0", textAlign: "center" }}>
            <button
              onClick={() => goToReport(completedResult)}
              className="summarize-report-btn"
              style={{
                background: "linear-gradient(135deg, #0284c7, #2563eb)",
                color: "#ffffff",
                border: "none",
                padding: "14px 28px",
                borderRadius: "14px",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
                boxShadow: "0 4px 18px rgba(2, 132, 199, 0.4)",
                display: "inline-flex",
                alignItems: "center",
                gap: "10px"
              }}
            >
              📊 Summarize / View Full Clinical Report
            </button>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="quick-suggestions">
        <button onClick={() => handleSend(t.chip1 || "Gums bleed when brushing")}>
          {t.chip1 || "Gums bleed when brushing"}
        </button>
        <button onClick={() => handleSend(t.chip2 || "Severe throbbing tooth pain")}>
          {t.chip2 || "Severe throbbing tooth pain"}
        </button>
        <button onClick={() => handleSend(t.chip3 || "Swelling on my right cheek")}>
          {t.chip3 || "Swelling on my right cheek"}
        </button>
        <button onClick={() => handleSend(t.chip4 || "Teeth feel slightly loose")}>
          {t.chip4 || "Teeth feel loose when biting"}
        </button>
      </div>

      {/* Medical Disclaimer */}
      <div className="chat-disclaimer">
        <span>⚕️ This tool provides educational information only — not a substitute for professional dental diagnosis.</span>
      </div>

      {/* Input Control Bar */}
      <div className="chat-input-bar glass-card">
        <ImageUpload onImageSelected={handleImageSelected} disabled={loading} />

        <input
          ref={inputRef}
          type="text"
          placeholder={t.typePlaceholder || "Describe your tooth or gum symptoms in English or Tamil..."}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          disabled={loading}
        />

        <VoiceButton onTranscript={handleVoiceTranscript} disabled={loading} />

        <button
          className="send-btn"
          onClick={() => handleSend()}
          disabled={!inputText.trim() || loading}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default Chat;