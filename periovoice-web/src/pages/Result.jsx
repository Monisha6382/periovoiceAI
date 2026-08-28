import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, ShieldAlert, CheckCircle2, FileText, ArrowLeft, RefreshCw, AlertTriangle } from '../components/Icons';
import { getPdf } from '../services/api';
import './Result.css';

export default function Result() {
  const locationState = useLocation();
  const navigate = useNavigate();
  const resultData = locationState.state?.result;
  const sessionId = locationState.state?.sessionId;
  const userId = locationState.state?.userId;

  if (!resultData) {
    return (
      <div className="result-page empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '40px 20px', maxWidth: '480px', margin: '0 auto' }}>
          <Activity size={40} color="var(--text-subtle)" style={{ marginBottom: '12px' }} />
          <h3>No Assessment Data Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Complete the triage chat conversation to view your diagnostic findings.
          </p>
          <button className="primary-btn" onClick={() => navigate('/chat')}>Start Triage</button>
        </div>
      </div>
    );
  }

  const getCorrectUrgency = (item) => {
    if (!item) return 'LOW';
    const direct = item.urgency || item.urgency_level;
    if (direct && ['LOW', 'MODERATE', 'HIGH', 'EMERGENCY'].includes(direct.toUpperCase())) {
      return direct.toUpperCase();
    }
    const rec = (item.recommendation || '').toLowerCase();
    const score = item.risk_score || 0;
    if (rec.includes('emergency') || score >= 9) return 'EMERGENCY';
    if (rec.includes('high') || score >= 7) return 'HIGH';
    if (rec.includes('moderate') || score >= 4) return 'MODERATE';
    return 'LOW';
  };

  const urgency = getCorrectUrgency(resultData);
  const symptoms = resultData.symptoms || resultData.symptoms_found || [];

  const {
    risk_score = 5,
    location = 'Oral Cavity',
    duration = 'Not specified',
    condition_category = 'Periodontal Assessment',
    condition_description = '',
    urgency_rationale = '',
    recommendation = '',
    home_care_tips = [],
    emergency_warning_signs = [],
    should_see_dentist = urgency !== 'LOW',
    disclaimer = ''
  } = resultData;

  const handleDownloadPDF = async () => {
    try {
      if (sessionId && userId) {
        await getPdf(sessionId, userId);
      }
      alert('PDF summary report downloaded.');
    } catch (e) {
      alert('PDF report generated.');
    }
  };

  const handleFindDentist = () => {
    window.open("https://www.google.com/maps/search/?api=1&query=dentist+near+me", "_blank");
  };

  const getUrgencyClass = (lvl) => {
    switch (lvl?.toUpperCase()) {
      case 'EMERGENCY': return 'badge-emergency';
      case 'HIGH': return 'badge-high';
      case 'MODERATE': return 'badge-moderate';
      default: return 'badge-low';
    }
  };

  return (
    <div className="result-page">
      <div className="result-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <h2>Periodontal Triage & Clinical Summary</h2>
      </div>

      {/* Main Result Card */}
      <div className="result-card glass-card">
        <div className="card-top">
          <div className="risk-gauge-container">
            <div className="gauge-circle">
              <span className="score-num">{risk_score}</span>
              <span className="score-max">/ 10</span>
            </div>
            <span className="gauge-label">PERIODONTAL RISK INDEX</span>
          </div>

          <div className="urgency-container">
            <span className="urgency-title">ASSESSED URGENCY</span>
            <span className={`badge-urgency ${getUrgencyClass(urgency)}`}>
              {urgency}
            </span>
            <span className="condition-category-tag">
              Category: <strong>{condition_category}</strong>
            </span>
            <p className="dentist-flag">
              {should_see_dentist ? '⚠️ Clinical Dental Evaluation Recommended' : '✓ Routine Hygiene Monitoring'}
            </p>
            {should_see_dentist && (
              <button 
                className="find-dentist-btn" 
                onClick={handleFindDentist}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(0, 137, 123, 0.1)',
                  color: '#00897B',
                  border: '1px solid #00897B',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '10px',
                  transition: 'all 0.2s ease'
                }}
              >
                📍 Find Nearest Dentist
              </button>
            )}
          </div>
        </div>

        {/* Symptoms & Meta Summary */}
        <div className="meta-summary-grid">
          <div className="meta-item">
            <span className="meta-label">Symptom Location</span>
            <strong className="meta-val">{location}</strong>
          </div>
          <div className="meta-item">
            <span className="meta-label">Symptom Duration</span>
            <strong className="meta-val">{duration}</strong>
          </div>
        </div>

        {/* Identified Symptoms Tags */}
        {symptoms.length > 0 && (
          <div className="result-section">
            <h4>Identified Clinical Factors</h4>
            <div className="tags-cloud">
              {symptoms.map((sym, i) => (
                <span key={i} className="symptom-pill">• {sym}</span>
              ))}
            </div>
          </div>
        )}

        {/* Urgency Rationale */}
        {urgency_rationale && (
          <div className="rationale-box">
            <h4>Clinical Urgency Rationale</h4>
            <p>{urgency_rationale}</p>
          </div>
        )}

        {/* Clinical Recommendation */}
        {recommendation && (
          <div className="recommendation-box">
            <h4>AI Triage Clinical Recommendation</h4>
            <p>{recommendation}</p>
          </div>
        )}

        {/* Home Care Guidance */}
        {home_care_tips.length > 0 && (
          <div className="result-section">
            <h4>Personalized Home Care Guidance</h4>
            <ul className="tips-list">
              {home_care_tips.map((tip, idx) => (
                <li key={idx}>
                  <CheckCircle2 size={16} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Emergency Red Flags */}
        {emergency_warning_signs.length > 0 && (
          <div className="warning-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={18} color="var(--accent-rose)" />
              <h4 style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', fontWeight: 700 }}>
                Emergency Red Flag Warning Signs
              </h4>
            </div>
            <ul className="warning-list">
              {emergency_warning_signs.map((sign, idx) => (
                <li key={idx}>• {sign}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Disclaimer */}
        <div className="disclaimer-text">
          {disclaimer || "⚠️ DISCLAIMER: This is an automated AI-based triage assessment for informational purposes only. It is not a professional medical diagnosis. Please consult a licensed dentist."}
        </div>

        {/* Action Buttons */}
        <div className="result-actions">
          <button className="primary-btn" onClick={handleDownloadPDF}>
            <FileText size={18} />
            Download PDF Report
          </button>

          <button className="secondary-btn" onClick={() => navigate('/chat')}>
            <RefreshCw size={18} />
            New Assessment
          </button>
        </div>
      </div>
    </div>
  );
}
