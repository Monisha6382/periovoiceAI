/**
 * History.jsx — PerioVoice AI
 * Shows all past assessments for the logged-in user.
 * Includes a trend chart and download option for each assessment.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getHistory, getPdf } from "../services/api";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend, Filler
} from "chart.js";
import UrgencyBadge from "../components/UrgencyBadge";
import "./History.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const URGENCY_SCORE = { LOW: 2, MODERATE: 5, HIGH: 8, EMERGENCY: 10 };

const History = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await getHistory(user.uid);
      setAssessments(data.assessments || []);
    } catch (err) {
      setError("Could not load history. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (assessmentId) => {
    try {
      const data = await getPdf(assessmentId, user.uid);
      const bytes = Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type: "application/pdf" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href = url; a.download = data.filename;
      a.click(); URL.revokeObjectURL(url);
    } catch {
      alert("PDF download failed.");
    }
  };

  // ── CHART DATA ──
  const chartData = {
    labels: assessments.map((a, i) =>
      new Date(a.date || a.created_at || Date.now()).toLocaleDateString()
    ),
    datasets: [{
      label: "Risk Score",
      data: assessments.map(a => a.risk_score || URGENCY_SCORE[a.urgency_level] || 1),
      borderColor: "#00897B",
      backgroundColor: "rgba(0,137,123,0.08)",
      borderWidth: 2.5,
      pointBackgroundColor: "#00897B",
      pointRadius: 5,
      fill: true,
      tension: 0.4,
    }],
  };
  const chartOptions = {
    responsive: true,
    scales: {
      y: { min: 0, max: 10, ticks: { stepSize: 2 }, grid: { color: "#f0f0f0" } },
      x: { grid: { display: false } },
    },
    plugins: { legend: { display: false } },
  };

  return (
    <div className="history-page">
      {/* HEADER */}
      <header className="history-header">
        <button className="back-btn" onClick={() => navigate("/")}>← Back</button>
        <h1 className="history-title">📋 Assessment History</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="new-btn" onClick={fetchHistory}>Refresh</button>
          <button className="new-btn" onClick={() => navigate("/chat")}>+ New</button>
          </div>
      </header>

      <div className="history-body">
        {loading && <div className="history-loading">Loading your assessments…</div>}
        {error   && <div className="history-error">{error}</div>}

        {!loading && assessments.length === 0 && (
          <div className="history-empty">
            <div className="empty-icon">🦷</div>
            <h3>No assessments yet</h3>
            <p>Complete your first assessment to see results here.</p>
            <button onClick={() => navigate("/chat")}>Start Assessment</button>
          </div>
        )}

        {/* TREND CHART */}
        {assessments.length > 1 && (
          <div className="chart-card">
            <h2 className="chart-title">Risk Score Trend</h2>
            <Line data={chartData} options={chartOptions} />
          </div>
        )}

        {/* ASSESSMENT LIST */}
        <div className="assessment-list">
          {[...assessments].reverse().map((item, i) => (
            <div key={item.assessment_id || i} className="assessment-card">
              <div className="card-top">
                <UrgencyBadge level={item.urgency_level} />
                <span className="card-date">
                  {new Date(item.date || item.created_at || Date.now()).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric"
                  })}
                </span>
              </div>
              <div className="card-score">Risk Score: <strong>{item.risk_score}</strong>/10</div>
              {item.recommendation && (
                <p className="card-rec">{item.recommendation.substring(0, 120)}…</p>
              )}
              <button
                className="btn-dl-pdf"
                onClick={() => handleDownloadPdf(item.assessment_id)}
              >
                📄 Download PDF
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default History;
