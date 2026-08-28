import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  MessageSquare, 
  Clock, 
  CalendarCheck, 
  User, 
  Moon, 
  Sun, 
  Stethoscope, 
  Settings, 
  ShieldCheck, 
  Globe,
  MoreVertical,
  RefreshCw
} from './Icons';
import './Navigation.css';

export default function Navigation({ children }) {
  const location = useLocation();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [backendUrl, setBackendUrl] = useState(localStorage.getItem('periovoice_backend_url') || 'http://localhost:8000');
  const [apiOnline, setApiOnline] = useState(true);
  const menuRef = React.useRef(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check connection status & add body class for mobile native status bar padding fallback
  useEffect(() => {
    const isNative = Boolean(
      window.Capacitor?.isNativePlatform?.() || 
      window.location.protocol === 'capacitor:' ||
      (typeof navigator !== 'undefined' && navigator.userAgent && /Android|iPhone|iPad/i.test(navigator.userAgent))
    );
    if (isNative) {
      document.body.classList.add('is-mobile-native');
    }

    const checkConnection = async () => {
      try {
        const response = await fetch(`${backendUrl}/health`);
        setApiOnline(response.ok);
      } catch (err) {
        setApiOnline(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 12000);
    return () => {
      clearInterval(interval);
      document.body.classList.remove('is-mobile-native');
    };
  }, [backendUrl]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleLanguage = () => {
    const nextLang = language === 'en' ? 'ta' : 'en';
    setLanguage(nextLang);
    localStorage.setItem('language', nextLang);
    window.location.reload();
  };

  const saveBackendSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('periovoice_backend_url', backendUrl);
    setShowSettings(false);
    window.location.reload();
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/chat', label: 'Triage Chat', icon: MessageSquare },
    { path: '/history', label: 'History', icon: Clock },
    { path: '/reminders', label: 'Care Tracker', icon: CalendarCheck },
    { path: '/profile', label: 'Profile', icon: User },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo">
            <Stethoscope size={22} color="white" />
          </div>
          <div className="brand-titles">
            <h1>PerioVoice AI™</h1>
            <div className="brand-subtitle-container" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="brand-subtitle">DENTAL AI</span>
              <span className={`status-dot ${apiOnline ? 'online' : 'offline'}`} />
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button 
            className="header-theme-btn" 
            onClick={toggleTheme} 
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="app-layout">
        {/* Desktop Sidebar */}
        <aside className="desktop-sidebar">
          <nav className="sidebar-nav">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="engine-info">
              <span className="info-title">PerioVoice AI Engine</span>
              <span className="info-sub">v2.0 • Clinical Triage</span>
            </div>
          </div>
        </aside>

        {/* Page View Container */}
        <main className="page-container">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-bar">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

    </div>
  );
}
