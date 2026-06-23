/**
 * AuthContext.js — PerioVoice AI
 * Provides user login state to all pages.
 * Uses Firebase Authentication (email + Google).
 */

import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is saved in localStorage (offline support)
    const savedUser = localStorage.getItem("periovoice_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Login with email/password (calls backend or Firebase)
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("periovoice_user", JSON.stringify(userData));
  };

  // Logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem("periovoice_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for easy access
export const useAuth = () => useContext(AuthContext);
