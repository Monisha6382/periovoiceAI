import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import "./Login.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e) => {
    e.preventDefault();

    if (!email) {
      setMessage("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await sendPasswordResetEmail(auth, email);

      setMessage("Password reset link sent. Please check your email or spam folder.");
    } catch (err) {
      setMessage("Could not send reset link. Please check the email address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="bg-circle bg-circle-1" />
        <div className="bg-circle bg-circle-2" />
        <div className="bg-circle bg-circle-3" />
      </div>

      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">🦷</div>
          <h1 className="login-title">Forgot Password</h1>
          <p className="login-subtitle">Enter your registered email to reset your password</p>
        </div>

        <div className="login-card">
          {message && <div className="login-error">{message}</div>}

          <form onSubmit={handleReset} className="login-form">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter registered email"
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <button
            type="button"
            className="btn-guest"
            onClick={() => navigate("/login")}
            style={{ marginTop: '16px' }}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;