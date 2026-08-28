import React, { useState, useEffect } from 'react';
import { Flame, CheckCircle2, Circle, Calendar, Plus, Trash2, Bell, Sparkles } from '../components/Icons';
import './Reminders.css';

export default function Reminders() {
  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem('periovoice_habits');
    return saved ? JSON.parse(saved) : [
      { id: 'h1', title: 'Morning Brushing (2 min)', done: true },
      { id: 'h2', title: 'Night Brushing (2 min)', done: false },
      { id: 'h3', title: 'Interdental Flossing', done: true },
      { id: 'h4', title: 'Antimicrobial Mouthwash Rinse', done: false },
    ];
  });

  const [reminders, setReminders] = useState(() => {
    const saved = localStorage.getItem('periovoice_reminders');
    return saved ? JSON.parse(saved) : [
      { id: 'r1', title: 'Bi-Annual Professional Scaling', date: '2026-08-15', dentist: 'Dr. Sarah Jenkins' },
      { id: 'r2', title: 'Replace Toothbrush Head', date: '2026-09-01', dentist: 'Self Care' }
    ];
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDentist, setNewDentist] = useState('');

  useEffect(() => {
    localStorage.setItem('periovoice_habits', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('periovoice_reminders', JSON.stringify(reminders));
  }, [reminders]);

  const toggleHabit = (id) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, done: !h.done } : h));
  };

  const completedCount = habits.filter(h => h.done).length;
  const streakDays = completedCount >= 3 ? 5 : 4;

  const handleAddReminder = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;
    const item = {
      id: 'r_' + Date.now(),
      title: newTitle.trim(),
      date: newDate,
      dentist: newDentist.trim() || 'Dental Clinic'
    };
    setReminders(prev => [...prev, item]);
    setNewTitle('');
    setNewDate('');
    setNewDentist('');
    setShowAddModal(false);
  };

  const deleteReminder = (id) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="reminders-page">
      <div className="page-header">
        <div>
          <h2>Care Tracker & Reminders</h2>
          <p>Maintain daily oral hygiene habits and schedule clinical checkup alerts.</p>
        </div>
      </div>

      {/* Streak Banner */}
      <div className="streak-card glass-card">
        <div className="streak-icon">
          <Flame size={28} color="var(--accent-amber)" />
        </div>
        <div className="streak-info">
          <h3>{streakDays} Days Oral Care Streak!</h3>
          <p>{completedCount} of {habits.length} daily habits completed today.</p>
        </div>
        <div className="streak-progress">
          <div className="streak-bar" style={{ width: `${(completedCount / habits.length) * 100}%` }}></div>
        </div>
      </div>

      {/* Daily Habits Checklist */}
      <section className="section-block">
        <h3 className="section-title">Daily Hygiene Routine</h3>
        <div className="habits-list">
          {habits.map(habit => (
            <div
              key={habit.id}
              className={`habit-item glass-card ${habit.done ? 'completed' : ''}`}
              onClick={() => toggleHabit(habit.id)}
            >
              <div className="habit-check">
                {habit.done ? (
                  <CheckCircle2 size={22} color="var(--accent-emerald)" />
                ) : (
                  <Circle size={22} color="var(--text-subtle)" />
                )}
              </div>
              <span className="habit-title">{habit.title}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Upcoming Dental Reminders */}
      <section className="section-block">
        <div className="section-header">
          <h3 className="section-title">Upcoming Dental Appointments</h3>
          <button className="primary-btn sm" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add Reminder
          </button>
        </div>

        {reminders.length === 0 ? (
          <div className="empty-card glass-card">
            <Bell size={32} color="var(--text-subtle)" />
            <p>No upcoming dental checkups scheduled.</p>
          </div>
        ) : (
          <div className="reminders-list">
            {reminders.map(rem => (
              <div key={rem.id} className="reminder-card glass-card">
                <div className="reminder-main">
                  <Calendar size={20} color="var(--accent-cyan)" />
                  <div>
                    <h4>{rem.title}</h4>
                    <span className="reminder-meta">Date: {rem.date} • {rem.dentist}</span>
                  </div>
                </div>
                <button className="delete-btn" onClick={() => deleteReminder(rem.id)} title="Delete Reminder">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule Dental Reminder</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddReminder} className="modal-body">
              <div className="form-group">
                <label>Reminder Title / Service</label>
                <input
                  type="text"
                  placeholder="e.g. Scaling & Dental Checkup"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Appointment Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Dentist / Clinic Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Smith Dental Care"
                  value={newDentist}
                  onChange={e => setNewDentist(e.target.value)}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Save Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
