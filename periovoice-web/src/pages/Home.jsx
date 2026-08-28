import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Camera, Clock, Activity, CalendarCheck, Sparkles, ArrowRight, Flame } from '../components/Icons';
import OnboardingModal from '../components/OnboardingModal';
import { getHistory } from '../services/api';
import { translations } from '../utils/translations';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import './Home.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lang] = useState(localStorage.getItem('language') || 'en');
  const t = translations[lang] || translations.en;

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);

  const [currentTip, setCurrentTip] = useState(0);
  const tips = [
    "Brush twice a day for two minutes to keep plaque at bay.",
    "Floss daily to remove hidden food particles and prevent gum disease.",
    "Stay hydrated! Drinking water helps wash away food and bacteria."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % tips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const calculateStreak = (hist) => {
    if (!hist || hist.length === 0) return 0;
    const dates = [...new Set(hist.map(h => new Date(h.created_at || Date.now()).toDateString()))]
      .map(d => new Date(d))
      .sort((a, b) => b - a);
      
    let streakCount = 0;
    let today = new Date();
    today.setHours(0,0,0,0);
    
    let current = today.getTime();
    for (let i = 0; i < dates.length; i++) {
      let diff = (current - dates[i].getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 0 || diff === 1) {
        streakCount++;
        current = dates[i].getTime();
      } else if (diff > 1) {
        break; 
      }
    }
    return streakCount;
  };

  useEffect(() => {
    const onboarded = localStorage.getItem('periovoice_onboarded');
    if (!onboarded) {
      setShowOnboarding(true);
    }
    fetchDashboardHistory();
  }, [user]);

  const fetchDashboardHistory = async () => {
    const userId = user?.uid || 'guest_patient';
    const serverData = await getHistory(userId);
    setHistory(serverData);
    setStreak(calculateStreak(serverData));
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const latestAssessment = history[0];

  const getCorrectUrgency = (item) => {
    if (!item) return 'LOW';
    if (item.urgency) return item.urgency;
    if (item.final_result && item.final_result.urgency) return item.final_result.urgency;
    const rec = (item.recommendation || '').toLowerCase();
    const score = item.risk_score || 0;
    
    if (rec.includes('emergency') || score >= 9) return 'EMERGENCY';
    if (rec.includes('high') || score >= 7) return 'HIGH';
    if (rec.includes('moderate') || score >= 4) return 'MODERATE';
    return 'LOW';
  };

  const getUrgencyText = (level) => {
    const key = (level || 'low').toLowerCase();
    const translatedLevel = t[key] || level;
    return `${translatedLevel} ${t.urgency || 'Urgency'}`;
  };

  // Prepare chart data
  const chartData = {
    labels: history.slice().reverse().map(item => new Date(item.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Periodontal Risk Score',
        data: history.slice().reverse().map(item => item.risk_score || 3),
        borderColor: '#00897B',
        backgroundColor: 'rgba(0, 137, 123, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00897B',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      y: {
        min: 1,
        max: 10,
        ticks: {
          stepSize: 1,
          color: 'var(--text-subtle)'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        }
      },
      x: {
        ticks: {
          color: 'var(--text-subtle)'
        },
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="home-dashboard">
      {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}

      {/* Hero Welcome Banner */}
      <section className="dashboard-hero glass-card">
        <div className="hero-content">
          <span className="hero-badge">
            <Sparkles size={14} color="var(--accent-cyan)" />
            {t.heroBadge}
          </span>
          <h2>{getGreeting()}, {user?.name || 'Monisha'}!</h2>
          <p>{t.heroDesc}</p>
          <div className="hero-actions">
            <button className="primary-hero-btn" onClick={() => navigate('/chat')}>
              <MessageSquare size={18} />
              {t.startVoiceTriage}
            </button>
            <button className="secondary-hero-btn" onClick={() => navigate('/chat')}>
              <Camera size={18} />
              {t.photoScan}
            </button>
          </div>
        </div>
      </section>

      {/* Health Stats Overview Grid */}
      <section className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-icon cyan">
            <Activity size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">{t.currentRiskLevel}</span>
            <h3 className="stat-value">
              {latestAssessment ? `${latestAssessment.risk_score || 4}/10` : '3/10'}
            </h3>
            <span className="stat-sub">
              {getUrgencyText(getCorrectUrgency(latestAssessment))}
            </span>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon amber">
            <Flame size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">{t.oralHygieneStreak}</span>
            <h3 className="stat-value">{streak} Days</h3>
            <span className="stat-sub">{t.dailyOralCare}</span>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon indigo">
            <Clock size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">{t.totalTriageChecks}</span>
            <h3 className="stat-value">{history.length} Saved</h3>
            <span className="stat-sub">{t.clinicalReports}</span>
          </div>
        </div>
      </section>

      {/* Symptom Risk Trend Chart */}
      {history.length > 0 && (
        <section className="trend-chart-section glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 className="section-title" style={{ marginBottom: '16px' }}>{t.symptomTrend}</h3>
          <div style={{ height: '220px', position: 'relative' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </section>
      )}

      {/* Health Tips Section */}
      <section className="health-tips-section glass-card" style={{ padding: '20px', marginBottom: '24px', backgroundColor: 'rgba(0, 137, 123, 0.05)', border: '1px solid var(--accent-cyan)' }}>
        <h3 className="section-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="var(--accent-cyan)" /> Daily Dental Tip
        </h3>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-main)', minHeight: '48px', transition: 'opacity 0.3s ease' }}>
          {tips[currentTip]}
        </p>
      </section>

      {/* Quick Action Feature Grid */}
      <section className="features-section">
        <h3 className="section-title">{t.clinicalServices}</h3>
        <div className="feature-grid">
          <div className="feature-card glass-card" onClick={() => navigate('/chat')}>
            <div className="feature-header">
              <div className="feature-icon cyan"><MessageSquare size={20} /></div>
              <ArrowRight size={18} className="arrow-icon" />
            </div>
            <h4>{t.conversationalTriage}</h4>
            <p>{t.conversationalDesc}</p>
          </div>

          <div className="feature-card glass-card" onClick={() => navigate('/chat')}>
            <div className="feature-header">
              <div className="feature-icon indigo"><Camera size={20} /></div>
              <ArrowRight size={18} className="arrow-icon" />
            </div>
            <h4>{t.tissueCameraScan}</h4>
            <p>{t.tissueCameraDesc}</p>
          </div>

          <div className="feature-card glass-card" onClick={() => navigate('/reminders')}>
            <div className="feature-header">
              <div className="feature-icon emerald"><CalendarCheck size={20} /></div>
              <ArrowRight size={18} className="arrow-icon" />
            </div>
            <h4>{t.careTrackerTitle}</h4>
            <p>{t.careTrackerDesc}</p>
          </div>
        </div>
      </section>

      {/* Recent Triage Activity */}
      <section className="activity-section">
        <div className="section-header">
          <h3 className="section-title">{t.recentHistory}</h3>
          <button className="text-link" onClick={() => navigate('/history')}>{t.viewAll}</button>
        </div>

        {history.length === 0 ? (
          <div className="empty-card glass-card">
            <Clock size={36} color="var(--text-subtle)" />
            <h4>{t.noHistoryYet}</h4>
            <p>{t.noHistoryDesc}</p>
            <button className="primary-btn" onClick={() => navigate('/chat')}>{t.startAssessment}</button>
          </div>
        ) : (
          <div className="activity-list">
            {history.slice(0, 3).map((item, idx) => {
              const urgency = getCorrectUrgency(item);
              return (
                <div key={idx} className="activity-item glass-card" onClick={() => navigate('/result', { state: { result: item } })}>
                  <div className="activity-main">
                    <span className={`badge-urgency badge-${urgency.toLowerCase()}`}>
                      {t[urgency.toLowerCase()] || urgency}
                    </span>
                    <div className="activity-text">
                      <h4>Periodontal Assessment #{history.length - idx}</h4>
                      <span className="activity-date">
                        {new Date(item.created_at || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="activity-score">
                    <span>Risk Score</span>
                    <strong>{item.risk_score || 3}/10</strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}