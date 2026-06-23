import React from "react";
import "./ChatBubble.css";

const ChatBubble = ({ message, isUser, isLoading, isImage, timestamp }) => {
  const time = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const formatText = (text) =>
    text.split("\n").map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
          )}
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });

  const speakMessage = () => {
    if ("speechSynthesis" in window && message) {
      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(message);
      speech.rate = 1;
      speech.pitch = 1;
      speech.volume = 1;

      window.speechSynthesis.speak(speech);
    }
  };

  return (
    <div className={`bubble-row ${isUser ? "user-row" : "ai-row"}`}>
      {!isUser && <div className="avatar">🦷</div>}

      <div className={`bubble ${isUser ? "user-bubble" : "ai-bubble"} ${isImage ? "image-bubble" : ""}`}>
        {isLoading ? (
          <div className="typing-indicator">
            <span /><span /><span />
          </div>
        ) : (
          <>
            <div className="bubble-text">{formatText(message)}</div>

            {!isUser && (
              <button
                type="button"
                className="speak-btn"
                onClick={speakMessage}
                title="Listen to AI response"
              >
                🔊
              </button>
            )}

            {time && <div className="bubble-time">{time}</div>}
          </>
        )}
      </div>

      {isUser && <div className="avatar user-avatar">👤</div>}
    </div>
  );
};

export default ChatBubble;