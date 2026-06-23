/**
 * Result.jsx — PerioVoice AI
 * Shows the final assessment result after the AI conversation.
 * Displays urgency level, risk gauge, symptoms, recommendations, and PDF download.
 */

import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UrgencyBadge from "../components/UrgencyBadge";
import RiskGauge from "../components/RiskGauge";
import { saveAssessment, getPdf } from "../services/api";
import "./Result.css";

const Result = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { result, sessionId, transcript, userId } = location.state || {};

  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [assessmentId, setAssessmentId] = useState(null);
  const [downloading, setDownloading]   = useState(false);

  if (!result) {
    return (
      <div className="result-error">
        <p>No result found. Please start a new assessment.</p>
        <button onClick={() => navigate("/chat")}>Start Assessment</button>
      </div>
    );
  }

  // ── SAVE ASSESSMENT ──
  const handleSave = async () => {
    if (saved || saving) return;
    try {
      setSaving(true);
      const data = await saveAssessment({
        user_id: userId,
        session_id: sessionId,
        conversation_transcript: transcript || [],
        urgency_level: result.urgency_level,
        risk_score: result.risk_score,
        symptoms_found: result.symptoms_found || [],
        recommendation: result.recommendation,
        detected_from_image: result.detected_from_image || null,
      });
      setAssessmentId(data.assessment_id);
      setSaved(true);
    } catch (err) {
      alert("Failed to save. Make sure backend is running.");
    } finally {
      setSaving(false);
    }
  };

  // ── DOWNLOAD PDF ──
  const handleDownloadPdf = async () => {
    const aid = assessmentId;
    if (!aid) { alert("Please save the assessment first."); return; }
    try {
      setDownloading(true);
      const data = await getPdf(aid, userId);
      const bytes = Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type: "application/pdf" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href = url; a.download = data.filename || "assessment.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("PDF download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const urgencyClass = result.urgency_level?.toLowerCase() || "low";

  return (
    <div className="result-page">
      {/* ── ANIMATED HERO BANNER ── */}
      <div className={`result-hero ${urgencyClass}`}>
        <div className="result-hero-inner">
          <div className="result-hero-icon">🦷</div>
          <h1 className="result-hero-title">Assessment Complete</h1>
          <p className="result-hero-sub">Here is your personalised dental urgency report</p>
        </div>
        <div className="hero-wave" />
      </div>

      <div className="result-body">
        {/* ── URGENCY BADGE ── */}
        <section className="result-section">
          <UrgencyBadge level={result.urgency_level} large />
        </section>

        {/* ── RISK GAUGE ── */}
        <section className="result-section result-gauge-section">
          <h2 className="section-title">Risk Score</h2>
          <RiskGauge score={result.risk_score} />
        </section>

        {/* ── SYMPTOMS ── */}
        {result.symptoms_found?.length > 0 && (
          <section className="result-section">
            <h2 className="section-title">Symptoms Detected</h2>
            <div className="symptoms-grid">
              {result.symptoms_found.map((s, i) => (
                <span key={i} className="symptom-tag">
                  {s.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── IMAGE FINDINGS ── */}
        {result.detected_from_image && (
          <section className="result-section">
            <h2 className="section-title">📷 Image Analysis</h2>
            <div className="info-box">{result.detected_from_image}</div>
          </section>
        )}

        {/* ── RECOMMENDATION ── */}
        <section className="result-section">
          <h2 className="section-title">Recommendation</h2>
          <div className={`recommendation-box ${urgencyClass}`}>
            {result.recommendation}
          </div>
        </section>

        {/* ── HOME CARE TIPS ── */}
        {result.home_care_tips?.length > 0 && (
          <section className="result-section">
            <h2 className="section-title">🏠 Home Care Tips</h2>
            <ul className="tips-list">
              {result.home_care_tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── SEE DENTIST ── */}
        <section className="result-section">
          <div className={`dentist-box ${result.should_see_dentist ? "yes" : "no"}`}>
            {result.should_see_dentist
              ? "✅ You should see a dentist"
              : "ℹ️ Home care may be sufficient for now"}
          </div>
        </section>

        {/* ── DISCLAIMER ── */}
        <div className="disclaimer">
          ⚠️ {result.disclaimer || "This is not a medical diagnosis. Always consult a licensed dentist."}
        </div>

        {/* ── ACTION BUTTONS ── */}
        <div className="result-actions">
          <button className="btn-save" onClick={handleSave} disabled={saving || saved}>
            {saving ? "Saving…" : saved ? "✅ Saved" : "💾 Save Assessment"}
          </button>
          <button className="btn-pdf" onClick={handleDownloadPdf} disabled={downloading || !saved}>
            {downloading ? "Downloading…" : "📄 Download PDF"}
          </button>
          <button
          className="btn-new"
          onClick={() => navigate("/chat", { state: { newSession: true } })}
          >
            🔄 New Assessment
          </button>
          <button className="btn-history" onClick={() => navigate("/history")}>
            📋 View History
          </button>
        </div>
      </div>
    </div>
  );
};

export default Result;
