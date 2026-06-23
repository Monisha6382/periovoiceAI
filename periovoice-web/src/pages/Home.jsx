/**
 * Home.jsx — PerioVoice AI
 * Landing / dashboard page shown after login.
 * Shows welcome, quick-start button, and feature overview.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Home.css";

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="home-page">
      {/* ── HEADER ── */}
      <header className="home-header">
        <div className="header-logo">🦷 PerioVoice AI™</div>
        <nav className="header-nav">
  <button onClick={() => navigate("/history")} className="nav-link">
    History
  </button>

  <button onClick={() => navigate("/profile")} className="nav-link">
    👤 Profile
  </button>

  <button onClick={logout} className="nav-link logout">
    Logout
  </button>
</nav>
      </header>

      {/* ── HERO ── */}
      <section className="hero-section">
        <div className="hero-badge">AI-Powered Dental Assessment</div>
        <h1 className="hero-title">
          Hello, <span className="hero-name">{user?.name || "there"}</span> 👋
        </h1>
        <p className="hero-subtitle">
          Describe your gum or tooth symptoms using voice, text, or a photo.
          Our AI will assess urgency and guide you on what to do next.
        </p>
        <button className="btn-start" onClick={() => navigate("/chat")}>
          🦷 Start Assessment
        </button>
        <p className="hero-disclaimer">
          ⚠️ This is not a medical diagnosis. Always consult a licensed dentist.
        </p>
      </section>

      {/* ── FEATURES ── */}
      <section className="features-section">
        <div className="feature-card">
          <div className="feature-icon">🎤</div>
          <h3>Voice Input</h3>
          <p>Speak your symptoms naturally. Our AI listens and understands.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">💬</div>
          <h3>Text Chat</h3>
          <p>Type your symptoms in a friendly chat interface.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📷</div>
          <h3>Image Analysis</h3>
          <p>Upload a photo of your gums or teeth for visual assessment.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📄</div>
          <h3>PDF Report</h3>
          <p>Download your assessment report to show your dentist.</p>
        </div>
      </section>

      {/* ── URGENCY LEGEND ── */}
      <section className="legend-section">
        <h2>Urgency Levels</h2>
        <div className="legend-grid">
          <div className="legend-item low">🟢 LOW — Home care is enough</div>
          <div className="legend-item moderate">🟡 MODERATE — See dentist in 1–2 weeks</div>
          <div className="legend-item high">🔴 HIGH — See dentist within 48 hours</div>
          <div className="legend-item emergency">🚨 EMERGENCY — Go to dentist / ER now</div>
        </div>
      </section>
    </div>
  );
};

export default Home;
