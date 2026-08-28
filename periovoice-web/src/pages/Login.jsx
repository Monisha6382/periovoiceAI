import {
  signInWithPopup,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithCredential
} from "firebase/auth";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { Capacitor } from "@capacitor/core";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { auth, googleProvider } from "../firebase";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // ========== HANDLE EMAIL LOGIN/REGISTER ==========
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (isRegister && password.length < 8) {
  setError("Password must be at least 8 characters long.");
  setLoading(false);
  return;
}

if (
  isRegister &&
  !/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)
) {
  setError("Password must include uppercase, lowercase, number, and special character.");
  setLoading(false);
  return;
}
    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      if (isRegister) {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  await setDoc(doc(db, "users", userCredential.user.uid), {
  uid: userCredential.user.uid,
  name: name,
  email: email,
  createdAt: new Date().toISOString(),
});

await sendEmailVerification(userCredential.user);

  setError("Verification link sent to your email. Please verify before login.");
  setIsRegister(false);
  setLoading(false);
  return;
} else {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  if (!userCredential.user.emailVerified) {
    setError("Please verify your email before logging in.");
    setLoading(false);
    return;
  }
  await updateDoc(doc(db, "users", userCredential.user.uid), {
  lastLogin: new Date().toISOString(),
});

  login({ uid: userCredential.user.uid, name: userCredential.user.displayName || email.split("@")[0], email: userCredential.user.email, lastLogin: new Date().toISOString() });

  navigate("/");
}
    } catch (err) {
  if (err.code === "auth/email-already-in-use") {
    setError("This email is already registered. Please login.");
  } else if (err.code === "auth/invalid-email") {
    setError("Please enter a valid email address.");
  } else if (err.code === "auth/weak-password") {
    setError("Password must be at least 6 characters.");
  } else if (err.code === "auth/user-not-found") {
    setError("No account found with this email. Please register first.");
  } else if (err.code === "auth/wrong-password") {
    setError("Incorrect password. Please try again or use Forgot Password.");
  } else {
    setError(err.message || "Authentication failed. Please check your details.");
    console.error("Firebase Auth Error:", err.code, err.message);
  }
} finally {
      setLoading(false);
    }
  };

  // ========== HANDLE GOOGLE LOGIN ==========
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      let firebaseUser = null;
      const isNative = Capacitor.isNativePlatform() || (typeof window !== "undefined" && window.location.protocol === "capacitor:");

      if (isNative) {
        try {
          const result = await FirebaseAuthentication.signInWithGoogle();
          const idToken = result.credential?.idToken;
          if (idToken) {
            const credential = GoogleAuthProvider.credential(idToken);
            const userCredential = await signInWithCredential(auth, credential);
            firebaseUser = userCredential.user;
          } else if (result.user) {
            firebaseUser = result.user;
          }
        } catch (nativeErr) {
          console.warn("Native Google auth prompt error, attempting Web SDK popup:", nativeErr);
          try {
            const result = await signInWithPopup(auth, googleProvider);
            firebaseUser = result.user;
          } catch (webPopupErr) {
            setError("Google Sign-In requires selecting a valid Google account. Please log in with Email/Password or Continue as Guest.");
            setLoading(false);
            return;
          }
        }
      } else {
        try {
          const result = await signInWithPopup(auth, googleProvider);
          firebaseUser = result.user;
        } catch (popupErr) {
          setError("Google Sign-In was cancelled or failed. Please select your Google account or log in with Email.");
          setLoading(false);
          return;
        }
      }

      if (firebaseUser) {
        const userData = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Google Patient",
          email: firebaseUser.email || "patient@periovoice.ai",
          photoURL: firebaseUser.photoURL || "",
          lastLogin: new Date().toISOString(),
          isGuest: false
        };

        try {
          await setDoc(doc(db, "users", firebaseUser.uid), userData, { merge: true });
        } catch (e) {
          console.warn("Firestore user sync:", e);
        }

        login(userData);
        navigate("/");
      }
    } catch (err) {
      console.error("Google login error:", err);
      setError("Google Login Error: " + (err.message || "Authentication failed."));
    } finally {
      setLoading(false);
    }
  };

const handleGuestLogin = async () => {
    try {
      const anonRes = await signInAnonymously(auth);
      const guestUser = {
        uid: anonRes.user.uid,
        name: "Guest Patient",
        email: "guest@periovoice.ai",
        isGuest: true
      };
      login(guestUser);
      navigate("/");
    } catch (e) {
      const fallbackGuest = {
        uid: "guest_" + Math.random().toString(36).substr(2, 9),
        name: "Guest Patient",
        email: "guest@periovoice.ai",
        isGuest: true
      };
      login(fallbackGuest);
      navigate("/");
    }
  };
const handleForgotPassword = async () => {
  if (!email) {
    setError("Please enter your email first.");
    return;
  }

  try {
    setLoading(true);
    setError("");

    await sendPasswordResetEmail(auth, email);

    setError("Password reset link sent to your email.");
  } catch (err) {
    setError("Could not send reset email. Please check the email address.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="login-page">
      {/* Background decoration */}
      <div className="login-bg">
        <div className="bg-circle bg-circle-1" />
        <div className="bg-circle bg-circle-2" />
        <div className="bg-circle bg-circle-3" />
      </div>

      <div className="login-container">
        {/* Logo & Title */}
        <div className="login-header">
          <div className="login-logo">🦷</div>
          <h1 className="login-title">PerioVoice AI™</h1>
          <p className="login-subtitle">Your AI Dental Symptom Assistant</p>
        </div>

        {/* Card */}
        <div className="login-card">
          <div className="login-tabs">
            <button
              className={`tab-btn ${!isRegister ? "active" : ""}`}
              onClick={() => setIsRegister(false)}
            >
              Login
            </button>
            <button
              className={`tab-btn ${isRegister ? "active" : ""}`}
              onClick={() => setIsRegister(true)}
            >
              Register
            </button>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            {isRegister && (
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            {!isRegister && (
              <button
              type="button"
              className="forgot-password-btn"
              onClick={() => navigate("/forgot-password")}
              >
                Forgot Password?
                </button>
            )}
            {isRegister && (
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                />
              </div>
              )}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Please wait..." : isRegister ? "Create Account" : "Login"}
            </button>
          </form>

          <div className="divider"><span>or</span></div>

          <button className="btn-google" onClick={handleGoogleLogin}>
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            Continue with Google
          </button>

          <button className="btn-guest" onClick={handleGuestLogin} style={{
            width: '100%',
            padding: '12px',
            borderRadius: '12px',
            border: '1px dashed var(--border-glass)',
            background: 'transparent',
            color: 'var(--text-main)',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}>
            Continue as Guest
          </button>
        </div>

        <p className="login-disclaimer">
          🔒 Your data is private and secure. This app is for educational purposes only.
        </p>
      </div>
    </div>
  );
};

export default Login;
