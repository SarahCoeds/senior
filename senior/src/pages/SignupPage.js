import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../style/Signup.css";

const SignupPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState("signup"); 
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [error, setError] = useState("");
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

  const closeNotification = () => setShowNotification(false);

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.redirectToLogin) {
          displayNotification("Account already exists. Please log in.", "info");
          setTimeout(() => navigate("/login"), 1200);
          return;
        }
        setError(data.message || "Signup failed");
        return;
      }

      setSignupEmail(email);
      setStep("verify");
      displayNotification(
        "OTP sent to your email! Check your inbox (and spam folder).",
        "success"
      );
    } catch (err) {
      console.error("Signup error:", err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("OTP must be 6 digits");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signupEmail, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Invalid OTP");
        return;
      }


      login(data.user, data.token);
      displayNotification("Email verified successfully! Welcome to Kindred PCs.", "success");


      setTimeout(() => {
        if (data.user?.isAdmin) navigate("/admin");
        else navigate("/ai");
      }, 900);

    } catch (err) {
      console.error("OTP verification error:", err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signupEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to resend OTP");
        return;
      }

      displayNotification("New OTP sent! Check your email.", "success");
    } catch {
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <video className="bg-video" autoPlay muted loop>
        <source src="Assets/14646022_1920_1080_30fps.mp4" type="video/mp4" />
      </video>

      <div className="overlay">
        <div className="login-card">
          <h2>Create Your Kindred Account</h2>

          {error && (
            <div
              className="error-message"
              style={{
                color: "#ff6b6b",
                backgroundColor: "rgba(255, 107, 107, 0.1)",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
                borderLeft: "4px solid #ff6b6b",
              }}
            >
              {error}
            </div>
          )}

          {step === "signup" ? (
            <form onSubmit={handleSignupSubmit}>
              <label>Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />

              <label>Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />

              <label>Password (min. 6 characters)</label>
              <input
                type="password"
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />

              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />

              <button type="submit" disabled={loading}>
                {loading ? "Processing..." : "Sign Up"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpVerify}>
              <h3 style={{ color: "#646cff", marginBottom: "10px" }}>
                Verify Your Email
              </h3>
              <p style={{ marginBottom: "20px", color: "#ccc" }}>
                Enter the 6-digit OTP sent to{" "}
                <strong style={{ color: "#fff" }}>{signupEmail}</strong>
              </p>

              <label>OTP Code</label>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                disabled={loading}
                maxLength="6"
                style={{ letterSpacing: "3px", fontSize: "18px", textAlign: "center" }}
              />

              <button type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify OTP"}
              </button>

              <div style={{ marginTop: "20px", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="resend-otp-btn"
                >
                  {loading ? "Sending..." : "Resend OTP"}
                </button>

                <p style={{ marginTop: "12px", fontSize: "14px", color: "#888" }}>
                  Didn't receive OTP? Check your spam folder.
                </p>
              </div>
            </form>
          )}

          <p className="signup-link">
            Already have an account?{" "}
            <span onClick={() => navigate("/login")} className="login-link">
              Login
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

export default SignupPage;
