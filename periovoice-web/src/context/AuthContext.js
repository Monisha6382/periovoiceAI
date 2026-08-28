/**
 * AuthContext.js — PerioVoice AI
 * Provides user login state to all pages.
 * Supports guest mode so chat works instantly without forcing authentication.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for saved guest user first
    const savedUser = localStorage.getItem('periovoice_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.isGuest) {
          setUser(parsed);
        }
      } catch (e) { /* ignore */ }
    }

    // Safety fallback timer for mobile WebView execution: ensure loading state completes within 1.2s
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimer);
      if (firebaseUser) {
        // Fetch additional user data from Firestore
        let userData = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Patient',
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL || '',
          emailVerified: firebaseUser.emailVerified,
          lastLogin: new Date().toISOString(),
          isGuest: false
        };
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const firestoreData = userDoc.data();
            userData.name = firestoreData.name || userData.name;
          }
          // Save / merge user details in Firestore
          await setDoc(doc(db, 'users', firebaseUser.uid), userData, { merge: true });
        } catch (e) { /* Firestore unavailable, use auth data */ }
        setUser(userData);
        localStorage.setItem('periovoice_user', JSON.stringify(userData));
      } else {
        // No Firebase user - check if guest
        const saved = localStorage.getItem('periovoice_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.isGuest) {
              setUser(parsed);
            } else {
              setUser(null);
              localStorage.removeItem('periovoice_user');
            }
          } catch(e) {
            setUser(null);
          }
        }
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('periovoice_user', JSON.stringify(userData));
  };

  const loginAsGuest = () => {
    const guestUser = {
      uid: 'guest_' + Math.random().toString(36).substr(2, 9),
      name: 'Guest Patient',
      email: 'patient@periovoice.ai',
      isGuest: true
    };
    setUser(guestUser);
    localStorage.setItem('periovoice_user', JSON.stringify(guestUser));
  };

  const logout = async () => {
    try {
      if (user && !user.isGuest) {
        await signOut(auth);
      }
    } catch (e) { /* ignore */ }
    localStorage.removeItem('periovoice_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginAsGuest, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
