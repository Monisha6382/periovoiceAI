import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Profile.css";

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar">
  {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
</div>

        <h2>{user?.name || "User"}</h2>

<p className="profile-email">
  {user?.email || "No email available"}
</p>
<h3>Personal Information</h3>

<div className="profile-info">
          <p><strong>Name:</strong> {user?.name || "User"}</p>
          <p><strong>Email:</strong> {user?.email || "Not available"}</p>
          <p><strong>Account Created:</strong> {user?.createdAt ? new Date(user.createdAt).toLocaleString() : "Not available"}</p>
        </div>
        <h3>Dental Summary</h3>

<div className="profile-info">
  <p><strong>Total Assessments:</strong> 0</p>
  <p><strong>Last Assessment:</strong> No assessments yet</p>
  <p><strong>Risk Status:</strong> Healthy</p>
</div>
        <button className="profile-btn" onClick={() => navigate("/")}>
          Back to Home
        </button>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Profile;