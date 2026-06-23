/**
 * App.jsx — PerioVoice AI
 * Main router. Wraps all pages with AuthProvider.
 * Protected routes redirect to login if not authenticated.
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Home    from "./pages/Home";
import Chat    from "./pages/Chat";
import Result  from "./pages/Result";
import History from "./pages/History";
import Login   from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";

// ── Protected Route: redirects to /login if not logged in ──
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontSize:"1.5rem" }}>🦷</div>;
  return user ? children : <Navigate to="/login" />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/"       element={<ProtectedRoute><Home /></ProtectedRoute>} />
    <Route path="/chat"   element={<ProtectedRoute><Chat /></ProtectedRoute>} />
    <Route path="/result" element={<ProtectedRoute><Result /></ProtectedRoute>} />
    <Route path="/history"element={<ProtectedRoute><History /></ProtectedRoute>} />
    <Route path="*"       element={<Navigate to="/" />} />
  </Routes>
);

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
