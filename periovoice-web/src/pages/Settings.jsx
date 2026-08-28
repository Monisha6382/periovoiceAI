import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { deleteUser, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Settings as SettingsIcon } from '../components/Icons';
import { deleteAssessment, getHistory, getBackendUrl } from '../services/api';
import './Settings.css';

const Settings = () => {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'en';
  });

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [passwordForDelete, setPasswordForDelete] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [backendUrl, setBackendUrl] = useState(() => {
    return getBackendUrl();
  });
  const [apiOnline, setApiOnline] = useState(false);

  useEffect(() => {
    let active = true;
    const checkConnection = async () => {
      try {
        const response = await fetch(`${backendUrl}/health`);
        if (active) setApiOnline(response.ok);
      } catch (err) {
        if (active) setApiOnline(false);
      }
    };
    checkConnection();
    return () => { active = false; };
  }, [backendUrl]);

  const saveBackendSettings = () => {
    localStorage.setItem('periovoice_backend_url', backendUrl);
    setMessage('Backend connection URL saved successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);
  
  const handleLanguageChange = (e) => {
    const nextLang = e.target.value;
    setLanguage(nextLang);
    localStorage.setItem('language', nextLang);
    setMessage('Language settings updated. Reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };



  const handlePasswordReset = async () => {
    if (!user || !user.email || user.isGuest) return;
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, user.email);
      setMessage('Password reset email sent successfully! Please check your inbox.');
    } catch (error) {
      setMessage('Error sending reset email: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || user.isGuest) return;
    if (!passwordForDelete) {
      setMessage('Please enter your password to confirm account deletion.');
      return;
    }
    try {
      setLoading(true);
      const credential = EmailAuthProvider.credential(user.email, passwordForDelete);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Delete user document from Firestore
      await deleteDoc(doc(db, 'users', user.uid));
      
      // Delete user from Firebase Auth
      await deleteUser(auth.currentUser);
      
      setMessage('Account deleted successfully.');
      setTimeout(async () => {
        await logout();
      }, 1500);
    } catch (error) {
      setMessage('Re-authentication failed. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      setLoading(true);
      // Clear localStorage
      localStorage.removeItem('periovoice_history');

      // Clear Firestore assessments if logged in
      if (user && !user.isGuest) {
        const historyData = await getHistory(user.uid);
        if (Array.isArray(historyData)) {
          for (const item of historyData) {
            const id = item.assessment_id || item.id;
            if (id) {
              await deleteAssessment(id);
            }
          }
        }
      }
      setMessage('Assessment history cleared successfully.');
    } catch (error) {
      setMessage('Error clearing history: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    const localHistory = JSON.parse(localStorage.getItem('periovoice_history') || '[]');
    const data = JSON.stringify({
      user,
      profile: JSON.parse(localStorage.getItem('periovoice_profile') || '{}'),
      localHistory,
      exportedAt: new Date().toISOString()
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `periovoice_health_data_${user?.uid?.substring(0, 6) || 'export'}.json`;
    a.click();
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <SettingsIcon size={24} color="var(--accent-cyan)" />
        <h2>Application Settings</h2>
      </div>

      {message && <div className="settings-message glass-card">{message}</div>}

      <div className="settings-section glass-card">
        <h3>Appearance</h3>
        <div className="settings-row">
          <span>Dark Theme Mode</span>
          <label className="switch">
            <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="settings-section glass-card">
        <h3>Language Preferences</h3>
        <div className="settings-row">
          <span>Choose Language / மொழி</span>
          <select value={language} onChange={handleLanguageChange} className="settings-select">
            <option value="en">English</option>
            <option value="ta">Tamil / தமிழ்</option>
          </select>
        </div>
      </div>

      <div className="settings-section glass-card">
        <h3>Backend API Connection</h3>
        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Backend Server URL</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`status-dot ${apiOnline ? 'online' : 'offline'}`} style={{ width: '8px', height: '8px', borderRadius: '50%', background: apiOnline ? '#10b981' : '#f59e0b', display: 'inline-block', boxShadow: apiOnline ? '0 0 8px #10b981' : '0 0 8px #f59e0b' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>{apiOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <input 
            type="text" 
            value={backendUrl} 
            onChange={(e) => setBackendUrl(e.target.value)} 
            placeholder="http://192.168.1.XX:8000"
            className="settings-input"
            style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', color: 'white' }}
          />
          <button onClick={saveBackendSettings} className="primary-btn" style={{ alignSelf: 'flex-end', padding: '8px 16px', borderRadius: '8px', background: 'var(--accent-cyan)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
            Save Connection
          </button>
        </div>
      </div>



      <div className="settings-section glass-card">
        <h3>Account & Security</h3>
        {!user?.isGuest ? (
          <>
            <div className="settings-row">
              <span>Change Account Password</span>
              <button onClick={handlePasswordReset} className="secondary-btn" disabled={loading}>
                Send Reset Email
              </button>
            </div>
            <div className="settings-row">
              <span>Delete Account & Medical Data</span>
              <button onClick={() => setShowConfirmDelete(true)} className="secondary-btn danger-btn" disabled={loading}>
                Delete
              </button>
            </div>
            
            {showConfirmDelete && (
              <div className="delete-confirm-modal glass-card" style={{ marginTop: '16px', padding: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <p style={{ color: 'var(--accent-rose)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '12px' }}>
                  ⚠️ Warning: This will permanently delete your account and all saved assessments from Firestore.
                </p>
                <input 
                  type="password" 
                  placeholder="Enter password to confirm" 
                  value={passwordForDelete}
                  onChange={(e) => setPasswordForDelete(e.target.value)}
                  className="settings-input"
                  style={{ width: '100%', marginBottom: '12px' }}
                />
                <div className="modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowConfirmDelete(false)} className="secondary-btn">Cancel</button>
                  <button onClick={handleDeleteAccount} className="primary-btn danger-btn">Confirm Delete</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: '0.88rem', color: 'var(--text-subtle)' }}>Please log in to manage password settings and cloud backups.</p>
        )}
      </div>

      <div className="settings-section glass-card">
        <h3>Data Management</h3>
        <div className="settings-row">
          <span>Clear Local Triage History</span>
          <button onClick={handleClearHistory} className="secondary-btn" disabled={loading}>Clear</button>
        </div>
        <div className="settings-row">
          <span>Export All Data (JSON)</span>
          <button onClick={handleExportData} className="secondary-btn">Export Data</button>
        </div>
      </div>

      <div className="settings-section glass-card about-section" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
        <h3>Application Info</h3>
        <p style={{ fontSize: '0.9rem', marginBottom: '6px' }}><strong>PerioVoice AI™</strong> v2.0.0</p>
        <p className="disclaimer" style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', lineHeight: '1.4', marginBottom: '8px' }}>
          Disclaimer: This system is an automated triage tool. It does not provide medical diagnoses or replace clinical evaluations by a licensed dentist.
        </p>
        <p className="credits" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>Built with ❤️ for your dental wellness.</p>
      </div>
    </div>
  );
};

export default Settings;
