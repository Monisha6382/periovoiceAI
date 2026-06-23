/**
 * UrgencyBadge.jsx — PerioVoice AI
 * Colored badge showing urgency level with icon.
 */
import React from "react";
import "./UrgencyBadge.css";

const URGENCY_CONFIG = {
  LOW:       { color: "#4CAF50", bg: "#E8F5E9", icon: "🟢", label: "LOW RISK",   text: "Home care is enough" },
  MODERATE:  { color: "#FFC107", bg: "#FFF8E1", icon: "🟡", label: "MODERATE",   text: "See dentist in 1–2 weeks" },
  HIGH:      { color: "#F44336", bg: "#FFEBEE", icon: "🔴", label: "HIGH",       text: "See dentist within 48 hours" },
  EMERGENCY: { color: "#9C27B0", bg: "#F3E5F5", icon: "🚨", label: "EMERGENCY",  text: "Go to dentist / ER immediately" },
};

const UrgencyBadge = ({ level, large }) => {
  const config = URGENCY_CONFIG[level] || URGENCY_CONFIG.LOW;
  return (
    <div
      className={`urgency-badge ${large ? "large" : ""}`}
      style={{ background: config.bg, borderColor: config.color, color: config.color }}
    >
      <span className="urgency-icon">{config.icon}</span>
      <div className="urgency-text">
        <span className="urgency-label">{config.label}</span>
        {large && <span className="urgency-sub">{config.text}</span>}
      </div>
    </div>
  );
};

export default UrgencyBadge;
