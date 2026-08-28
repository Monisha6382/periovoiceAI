import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Clock, Trash2, ChevronRight } from '../components/Icons';
import { getHistory, deleteAssessment } from '../services/api';
import { translations } from '../utils/translations';
import './History.css';

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lang] = useState(localStorage.getItem('language') || 'en');
  const t = translations[lang] || translations.en;

  const [historyList, setHistoryList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    const userId = user?.uid || 'guest_patient';
    const serverData = await getHistory(userId);
    setHistoryList(serverData);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const userId = user?.uid || 'guest_patient';
    const userCacheKey = `periovoice_history_${userId}`;
    try {
      await deleteAssessment(deleteTarget);
    } catch (e) {
      console.warn("Delete API error:", e);
    }
    const updated = historyList.filter(item => item.id !== deleteTarget && item.session_id !== deleteTarget && item.assessment_id !== deleteTarget);
    setHistoryList(updated);
    localStorage.setItem(userCacheKey, JSON.stringify(updated));
    setDeleteTarget(null);
  };

  const getCorrectUrgency = (item) => {
    const rec = (item.recommendation || '').toLowerCase();
    const score = item.risk_score || 0;
    
    if (rec.includes('emergency') || score >= 9) return 'EMERGENCY';
    if (rec.includes('high') || score >= 7) return 'HIGH';
    if (rec.includes('low') || (score > 0 && score < 4)) return 'LOW';
    return 'MODERATE';
  };

  const filteredHistory = historyList.filter(item => {
    const symptoms = item.symptoms || item.symptoms_found || [];
    const recommendation = item.recommendation || '';
    const urgency = getCorrectUrgency(item);

    const matchesSearch = searchQuery === '' || 
      recommendation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (symptoms && symptoms.some(s => String(s).toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesUrgency = urgencyFilter === 'ALL' || urgency.toUpperCase() === urgencyFilter;

    return matchesSearch && matchesUrgency;
  });

  return (
    <div className="history-page">
      <div className="page-header">
        <div>
          <h2>{t.historyTitle}</h2>
          <p>{t.historySub}</p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="controls-bar glass-card">
        <div className="search-box">
          <Search size={18} color="var(--text-subtle)" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          {['ALL', 'EMERGENCY', 'HIGH', 'MODERATE', 'LOW'].map(lvl => (
            <button
              key={lvl}
              className={`filter-pill ${urgencyFilter === lvl ? 'active' : ''}`}
              onClick={() => setUrgencyFilter(lvl)}
            >
              {t[lvl.toLowerCase()] || lvl}
            </button>
          ))}
        </div>
      </div>

      {/* History Items List */}
      {filteredHistory.length === 0 ? (
        <div className="empty-card glass-card">
          <Clock size={36} color="var(--text-subtle)" />
          <h4>{t.noRecordsFound}</h4>
        </div>
      ) : (
        <div className="history-grid">
          {filteredHistory.map((item, idx) => (
            <div key={item.id || idx} className="history-card glass-card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge-urgency badge-${getCorrectUrgency(item).toLowerCase()}`}>
                    {getCorrectUrgency(item)}
                  </span>
                  <span className="card-date">
                    {new Date(item.created_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className="delete-icon-btn"
                  onClick={() => setDeleteTarget(item.id)}
                  title={t.deleteRecord}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="card-body">
                <div className="score-row">
                  <span>Risk Score:</span>
                  <strong>{item.risk_score || 3}/10</strong>
                </div>

                <p className="recommendation-snippet">
                  {item.recommendation || 'Assessment complete. Follow home care advice.'}
                </p>

                {(() => {
                  const symptoms = item.symptoms || item.symptoms_found || [];
                  return symptoms.length > 0 && (
                    <div className="mini-tags">
                      {symptoms.slice(0, 3).map((s, i) => (
                        <span key={i} className="mini-tag">• {s}</span>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="card-footer">
                <button
                  className="view-btn"
                  onClick={() => navigate('/result', { state: { result: item } })}
                >
                  {t.viewFullAssessment} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t.deleteRecord}</h3>
              <button className="close-btn" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {t.deleteConfirmText}
            </p>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="secondary-btn" onClick={() => setDeleteTarget(null)}>{t.cancel}</button>
              <button className="danger-btn" onClick={handleDelete} style={{ background: 'var(--accent-rose)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
