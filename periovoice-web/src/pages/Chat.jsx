/**
 * Chat.jsx — PerioVoice AI
 * Main chat screen. Supports voice, text, and image input.
 * Sends messages to backend, shows AI replies, navigates to Result on completion.
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import VoiceButton from "../components/VoiceButton";
import ImageUpload from "../components/ImageUpload";
import ChatBubble from "../components/ChatBubble";
import { startSession, sendChat, analyzeImage } from "../services/api";
import "./Chat.css";

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── STATE ──
  const [messages, setMessages]       = useState([]);
  const [inputText, setInputText]     = useState("");
  const [sessionId, setSessionId]     = useState(null);
  const [loading, setLoading]         = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedImage, setSelectedImage]   = useState(null);
  const [imageAnalyzed, setImageAnalyzed]   = useState(false);
  const [questionNum, setQuestionNum] = useState(0);
  const totalQuestions = 7;
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const hasStartedRef = useRef(false);

  // ── START SESSION ON MOUNT ──
  useEffect(() => {
    if (user && !hasStartedRef.current) {
      hasStartedRef.current = true;
      initSession();
    }
  }, [user]);

  // ── AUTO SCROLL ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (text, isUser, extra = {}) => {
    setMessages(prev => [...prev, { text, isUser, timestamp: new Date().toISOString(), ...extra }]);
  };

  // ── INIT SESSION ──
  const initSession = async () => {
    try {
      setLoading(true);
      setSessionStarted(true);
      const data = await startSession(user.uid);
      setSessionId(data.session_id);
      addMessage(data.greeting, false);
    } catch (err) {
      addMessage("⚠️ Could not connect to backend. Make sure it's running on http://localhost:8000", false);
    } finally {
      setLoading(false);
    }
  };

  // ── SEND TEXT MESSAGE ──
  const handleSend = async () => {
    if (!inputText.trim() || loading || !sessionId) return;
    const userMsg = inputText.trim();
    setInputText("");
    addMessage(userMsg, true);
    await processMessage(userMsg, "text");
  };

  // ── VOICE TRANSCRIPT ──
  const handleVoiceTranscript = (transcript) => {
    setInputText(transcript);
    inputRef.current?.focus();
  };

  // ── IMAGE UPLOAD ──
  const handleImageSelected = async (file) => {
    setSelectedImage(file);
    if (!file || !sessionId || imageAnalyzed) return;

    try {
      setLoading(true);
      addMessage("📷 Analyzing your image...", false, { isLoading: true });
      const result = await analyzeImage(file, sessionId);
      setMessages(prev => prev.filter(m => !m.isLoading));
      addMessage(`🔍 **Image Analysis:**\n${result.image_description}`, false, { isImage: true });
      setImageAnalyzed(true);
    } catch (err) {
      setMessages(prev => prev.filter(m => !m.isLoading));
      addMessage("⚠️ Image analysis failed. Please continue with text.", false);
    } finally {
      setLoading(false);
    }
  };

  // ── PROCESS MESSAGE ──
  const processMessage = async (message, inputType) => {
    if (!sessionId) return;
    try {
      setLoading(true);
      addMessage("...", false, { isLoading: true });

      const data = await sendChat({
        userId: user.uid,
        message,
        inputType,
        sessionId,
      });

      // Remove loading bubble
      setMessages(prev => prev.filter(m => !m.isLoading));
      addMessage(data.response, false);
      setQuestionNum(q => Math.min(q + 1, totalQuestions));

      // If assessment complete → go to Result page
      if (data.is_assessment_complete && data.final_result) {
        setTimeout(() => {
          navigate("/result", {
            state: {
              result: data.final_result,
              sessionId,
              transcript: data.conversation_transcript,
              userId: user.uid,
            },
          });
        }, 1500);
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => !m.isLoading));
      addMessage("⚠️ Error connecting to AI. Please check your backend.", false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const progress = Math.round((questionNum / totalQuestions) * 100);

  return (
    <div className="chat-page">
      {/* ── HEADER ── */}
      <header className="chat-header">
        <button className="back-btn" onClick={() => navigate("/")}>← Back</button>
        <div className="chat-title">
          <span className="chat-logo">🦷</span>
          <span>PerioVoice AI™</span>
        </div>
        <div className="chat-status">
          <span className="status-dot" />
          AI Active
        </div>
      </header>


      {/* ── MESSAGES ── */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg.text} isUser={msg.isUser} isLoading={msg.isLoading} isImage={msg.isImage} timestamp={msg.timestamp} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── INPUT BAR ── */}
      <div className="chat-input-bar">
        <ImageUpload onImageSelected={handleImageSelected} disabled={loading} />
        <textarea
          ref={inputRef}
          className="chat-textarea"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your symptoms here… or use voice"
          rows={1}
          disabled={loading}
        />
        <VoiceButton onTranscript={handleVoiceTranscript} disabled={loading} />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={loading || !inputText.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default Chat;