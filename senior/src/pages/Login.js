import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../style/Login.css";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState("info");

  const displayNotification = (message, type = "info") => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);

    setTimeout(() => {
      setShowNotification(false);
    }, 4000);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsVerification) {
          displayNotification(
            "Please verify your email. Redirecting to verification.",
            "warning"
          );
          setTimeout(() => {
            navigate("/signup", { state: { email } });
          }, 1200);
          return;
        }
        displayNotification(data.message || "Login failed", "error");
        return;
      }

      // ✅ Login successful
      login(data.user, data.token);
      displayNotification("Login successful! Redirecting...", "success");

      // ✅ ADMIN → /admin, normal → /ai
      setTimeout(() => {
        if (data.user?.isAdmin) navigate("/admin");
        else navigate("/ai");
      }, 700);
    } catch (err) {
      console.error(err);
      displayNotification("Server error. Please try again later.", "error");
    } finally {
      setLoading(false);
    }
  };

  const closeNotification = () => {
    setShowNotification(false);
  };

  return (
    <div className="login-page">
      <video className="bg-video" autoPlay muted loop>
        <source src="Assets/14646022_1920_1080_30fps.mp4" type="video/mp4" />
      </video>

      <div className="overlay">
        <div className="login-card">
          <h2>Login to Kindred PCs</h2>

          <form onSubmit={handleLoginSubmit}>
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />

            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="signup-link">
            Don't have an account?{" "}
            <span
              style={{ cursor: "pointer", color: "#007bff" }}
              onClick={() => navigate("/signup")}
            >
              Sign Up
            </span>
          </p>
        </div>
      </div>

      {showNotification && (
        <div className={`notification-popup ${notificationType}`}>
          <div className="notification-content">
            <span className="notification-message">{notificationMessage}</span>
            <button className="notification-close" onClick={closeNotification}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
