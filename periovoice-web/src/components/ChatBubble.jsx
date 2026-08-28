import React from "react";
import "./ChatBubble.css";

const ChatBubble = ({ message }) => {
  const { 
    text = "", 
    isUser = false, 
    isLoading = false, 
    isImage = false, 
    imageUrl = null, 
    timestamp = null 
  } = message || {};

  const time = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const formatText = (txt) => {
    if (!txt || typeof txt !== "string") return "";
    return txt.split("\n").map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
          )}
          {i < txt.split("\n").length - 1 && <br />}
        </span>
      );
    });
  };

  const speakMessage = () => {
    if ("speechSynthesis" in window && text) {
      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(text);
      speech.rate = 1;
      speech.pitch = 1;
      speech.volume = 1;

      window.speechSynthesis.speak(speech);
    }
  };

  return (
    <div className={`bubble-row ${isUser ? "user-row" : "ai-row"}`}>
      {!isUser && (
        <div className="avatar bot-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
      )}

      <div className={`bubble ${isUser ? "user-bubble" : "ai-bubble"} ${isImage ? "image-bubble" : ""}`}>
        {isLoading ? (
          <div className="typing-indicator">
            <span /><span /><span />
          </div>
        ) : (
          <>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Uploaded dental image"
                className="chat-uploaded-image"
              />
            )}

            <div className="bubble-text">{formatText(text)}</div>

            <div className="bubble-footer">
              {!isUser && (
                <button
                  type="button"
                  className="speak-btn"
                  onClick={speakMessage}
                  title="Listen to AI response"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
              )}

              {time && <div className="bubble-time">{time}</div>}
            </div>
          </>
        )}
      </div>

      {isUser && (
        <div className="avatar user-avatar-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default ChatBubble;