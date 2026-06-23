/**
 * RiskGauge.jsx — PerioVoice AI
 * Animated semicircle gauge showing risk score 1-10.
 */
import React, { useEffect, useState } from "react";
import "./RiskGauge.css";

const RiskGauge = ({ score }) => {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimated(score), 300);
    return () => clearTimeout(timeout);
  }, [score]);

  // 0° = left, 180° = right (semicircle)
  const percent = (animated / 10);
  const angle = percent * 180 - 90; // -90 to 90 degrees

  const color =
    score <= 3 ? "#4CAF50" :
    score <= 6 ? "#FFC107" :
    score <= 8 ? "#F44336" : "#9C27B0";

  const label =
    score <= 3 ? "Low Risk" :
    score <= 6 ? "Moderate Risk" :
    score <= 8 ? "High Risk" : "Emergency";

  return (
    <div className="gauge-wrapper">
      <div className="gauge-container">
        <svg viewBox="0 0 200 110" className="gauge-svg">
          {/* Track */}
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e8f0ee" strokeWidth="18" strokeLinecap="round"/>
          {/* Fill */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={`${percent * 251.2} 251.2`}
            style={{ transition: "stroke-dasharray 1s ease, stroke 0.5s ease" }}
          />
          {/* Needle */}
          <g transform={`translate(100, 100) rotate(${angle})`} style={{ transition: "transform 1s ease" }}>
            <line x1="0" y1="0" x2="0" y2="-65" stroke={color} strokeWidth="3" strokeLinecap="round"/>
            <circle cx="0" cy="0" r="6" fill={color}/>
          </g>
          {/* Score text */}
          <text x="100" y="96" textAnchor="middle" fontSize="28" fontWeight="800" fill={color} fontFamily="Syne, sans-serif">
            {score}
          </text>
          <text x="100" y="108" textAnchor="middle" fontSize="10" fill="#888" fontFamily="DM Sans, sans-serif">
            / 10
          </text>
        </svg>
        {/* Min/Max labels */}
        <div className="gauge-labels">
          <span>1</span>
          <span style={{ color }}>{label}</span>
          <span>10</span>
        </div>
      </div>
    </div>
  );
};

export default RiskGauge;
