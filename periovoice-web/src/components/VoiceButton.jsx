import React, { useState, useEffect, useRef } from "react";
import "./VoiceButton.css";

const VoiceButton = ({ onTranscript, disabled }) => {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    setSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listeningRef.current = true;
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript.trim()) {
        onTranscript(transcript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      listeningRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      listeningRef.current = false;
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, [onTranscript]);

  const toggleListening = () => {
    if (!supported || disabled || !recognitionRef.current) return;

    try {
      if (listeningRef.current) {
        recognitionRef.current.stop();
        listeningRef.current = false;
        setIsListening(false);
      } else {
        recognitionRef.current.start();
      }
    } catch (err) {
      console.error("Voice start/stop error:", err);
      listeningRef.current = false;
      setIsListening(false);
    }
  };

  if (!supported) {
    return (
      <button
        className="voice-btn"
        disabled
        title="Voice input is not supported in this browser"
      >
        🎤
      </button>
    );
  }

  return (
    <button
      className={`voice-btn ${isListening ? "listening" : ""}`}
      onClick={toggleListening}
      disabled={disabled}
      title={isListening ? "Stop recording" : "Start voice input"}
      type="button"
    >
      {isListening && (
        <>
          <span className="pulse-ring ring-1" />
          <span className="pulse-ring ring-2" />
        </>
      )}
      <span className="voice-icon">{isListening ? "🔴" : "🎤"}</span>
    </button>
  );
};

export default VoiceButton;