import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, LogOut, Save, HeartPulse, Clock, ShieldCheck } from '../components/Icons';
import { getHistory } from '../services/api';
import './Profile.css';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    age: '',
    gender: '',
    lastCheckup: '6 Months Ago',
    conditions: '',
    tobaccoUse: 'No'
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [consultationCount, setConsultationCount] = useState(0);

  useEffect(() => {
    loadProfile();
    loadConsultationCount();
  }, [user]);

  const loadProfile = async () => {
    // Try Firestore first
    if (user?.uid && !user.isGuest) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.profile) {
            setProfile(prev => ({ ...prev, ...data.profile }));
            return;
          }
        }
      } catch (e) { /* Firestore unavailable */ }
    }
    // Fallback to localStorage
    const saved = localStorage.getItem('periovoice_profile');
    if (saved) {
      try {
        setProfile(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) { /* ignore */ }
    }
  };

  const loadConsultationCount = async () => {
    const localHistory = JSON.parse(localStorage.getItem('periovoice_history') || '[]');
    if (user?.uid) {
      try {
        const serverHistory = await getHistory(user.uid);
        if (Array.isArray(serverHistory) && serverHistory.length > 0) {
          setConsultationCount(serverHistory.length);
          return;
        }
      } catch (e) { /* fallback */ }
    }
    setConsultationCount(localHistory.length);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    // Save to localStorage always
    localStorage.setItem('periovoice_profile', JSON.stringify(profile));

    // Also save to Firestore if authenticated
    if (user?.uid && !user.isGuest) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          profile: profile,
          name: user.name,
          email: user.email,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Could not sync profile to cloud:', e);
      }
    }

    setIsSaving(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString()
    : new Date().toLocaleDateString();

  return (
    <div className="profile-page">
      <div className="page-header">
        <h2>Patient Profile</h2>
        <p>Manage your dental health records and personal information.</p>
      </div>

      {/* Profile Hero Card */}
      <div className="profile-hero glass-card">
        <div className="avatar-large">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <User size={36} color="white" />
          )}
        </div>
        <div className="user-info">
          <h3>{user?.name || 'Guest Patient'}</h3>
          <span className="user-email">{user?.email || 'patient@periovoice.ai'}</span>
          <span className="guest-badge">
            {user?.isGuest ? 'Guest Mode — Sign in to sync data across devices' : '✓ Verified Patient Account'}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="profile-stats">
        <div className="profile-stat-card glass-card">
          <Clock size={18} color="var(--accent-cyan)" />
          <div>
            <span className="stat-number">{consultationCount}</span>
            <span className="stat-label">Consultations</span>
          </div>
        </div>
        <div className="profile-stat-card glass-card" onClick={() => navigate('/history')}>
          <ShieldCheck size={18} color="var(--accent-indigo)" />
          <div>
            <span className="stat-number">View</span>
            <span className="stat-label">Full History →</span>
          </div>
        </div>
      </div>

      {/* Dental Health Info Form */}
      <form onSubmit={handleSave} className="profile-form glass-card">
        <div className="form-title">
          <HeartPulse size={20} color="var(--accent-cyan)" />
          <h3>Dental & Medical Profile</h3>
        </div>

        <div className="form-grid">
          <div className="input-group">
            <label>Age</label>
            <input
              type="number"
              placeholder="e.g. 28"
              value={profile.age}
              onChange={e => setProfile({ ...profile, age: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label>Gender</label>
            <select
              value={profile.gender}
              onChange={e => setProfile({ ...profile, gender: e.target.value })}
            >
              <option value="">Select Gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>

          <div className="input-group">
            <label>Last Dental Checkup</label>
            <select
              value={profile.lastCheckup}
              onChange={e => setProfile({ ...profile, lastCheckup: e.target.value })}
            >
              <option>Less than 6 Months Ago</option>
              <option>6 Months Ago</option>
              <option>Over 1 Year Ago</option>
              <option>Over 2 Years / Never</option>
            </select>
          </div>

          <div className="input-group">
            <label>Tobacco / Smoking Use</label>
            <select
              value={profile.tobaccoUse}
              onChange={e => setProfile({ ...profile, tobaccoUse: e.target.value })}
            >
              <option>No</option>
              <option>Yes (Occasional)</option>
              <option>Yes (Daily)</option>
            </select>
          </div>

          <div className="input-group full-width">
            <label>Known Medical Conditions / Allergies</label>
            <input
              type="text"
              placeholder="e.g. Diabetes, Penicillin allergy, blood thinners"
              value={profile.conditions}
              onChange={e => setProfile({ ...profile, conditions: e.target.value })}
            />
          </div>
        </div>

        <button type="submit" className="primary-btn" disabled={isSaving} style={{ width: 'fit-content', marginTop: '12px' }}>
          <Save size={16} />
          {isSaving ? 'Saving...' : isSaved ? '✓ Profile Saved!' : 'Save Dental Profile'}
        </button>
      </form>

      {/* Account Actions */}
      <div className="profile-actions">
        {user?.isGuest && (
          <button
            onClick={() => navigate('/login')}
            className="primary-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            Create an Account to Save Your Data
          </button>
        )}
        <button onClick={handleSignOut} className="secondary-btn danger-btn">
          <LogOut size={16} />
          {user?.isGuest ? 'Reset Guest Session' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
}