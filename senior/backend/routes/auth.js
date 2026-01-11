const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const transporter = require("../config/mailer");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const isAdminEmail = (email) => {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes((email || "").toLowerCase());
};



router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields required" });

  try {

    db.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
      async (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }


        if (results.length > 0) {
          const existingUser = results[0];
          
          if (existingUser.is_verified) {
            return res.status(400).json({ 
              message: "User already exists and is verified. Please log in instead.",
              redirectToLogin: true 
            });
          } else {

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const hashedPassword = await bcrypt.hash(password, 10);
            
            db.query(
              "UPDATE users SET name = ?, password = ?, otp = ? WHERE email = ?",
              [name, hashedPassword, otp, email],
              async (updateErr) => {
                if (updateErr) {
                  console.error("Update error:", updateErr);
                  return res.status(500).json({ message: "Database update error" });
                }
                

                try {
                  await transporter.sendMail({
                    to: email,
                    subject: "Verify your email",
                    text: `Your OTP code is: ${otp}`,
                  });
                  
                  res.status(200).json({ 
                    message: "OTP sent to your email (existing unverified user)", 
                    email,
                    needsOtp: true
                  });
                } catch (emailErr) {
                  console.error("Email error:", emailErr);
                  return res.status(500).json({ message: "Failed to send OTP email" });
                }
              }
            );
          }
        } else {

          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          const hashedPassword = await bcrypt.hash(password, 10);
          
          db.query(
            "INSERT INTO users (name, email, password, otp, is_verified) VALUES (?, ?, ?, ?, 0)",
            [name, email, hashedPassword, otp],
            async (insertErr) => {
              if (insertErr) {
                console.error("Insert error:", insertErr);
                return res.status(500).json({ message: "Failed to create user account" });
              }
              

              try {
                await transporter.sendMail({
                  to: email,
                  subject: "Verify your email",
                  text: `Your OTP code is: ${otp}`,
                });
                
                res.status(201).json({ 
                  message: "OTP sent to your email", 
                  email,
                  needsOtp: true
                });
              } catch (emailErr) {
                console.error("Email error:", emailErr);
                return res.status(500).json({ message: "Failed to send OTP email" });
              }
            }
          );
        }
      }
    );
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error during signup" });
  }
});

router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ message: "Email required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  db.query(
    "UPDATE users SET otp = ? WHERE email = ? AND is_verified = 0",
    [otp, email],
    async (err, result) => {
      if (err || result.affectedRows === 0) {
        return res.status(400).json({ message: "Invalid email" });
      }

      try {
        await transporter.sendMail({
          to: email,
          subject: "Your OTP Code",
          text: `Your OTP is: ${otp}`,
        });

        res.json({ message: "OTP resent successfully" });
      } catch {
        res.status(500).json({ message: "Email failed" });
      }
    }
  );
});


router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP required" });
  }

  db.query(
    "SELECT * FROM users WHERE email = ? AND otp = ?",
    [email, otp],
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }
      
      if (results.length === 0) {
        return res.status(400).json({ message: "Invalid OTP or email" });
      }

      const user = results[0];


      db.query(
        "UPDATE users SET is_verified = 1, otp = NULL WHERE id = ?",
        [user.id],
        (updateErr) => {
          if (updateErr) {
            console.error("Update error:", updateErr);
            return res.status(500).json({ message: "Failed to verify user" });
          }


          const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
          );

          res.json({
            message: "Email verified successfully",
            token,
            user: { 
              id: user.id, 
              name: user.name, 
              email: user.email,
              isAdmin: isAdminEmail(user.email)
            },
          });
        }
      );
    }
  );
});


router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });

      if (results.length === 0)
        return res.status(401).json({ message: "Invalid credentials" });

      const user = results[0];

      if (!user.is_verified) {
        return res.status(403).json({
          message: "Email not verified. Please verify first.",
          needsVerification: true
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: isAdminEmail(user.email)
        }
      });
    }
  );
});



router.post("/validate-token", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, message: "Token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    

    db.query(
      "SELECT id, name, email FROM users WHERE id = ? AND is_verified = 1",
      [decoded.id],
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return res.json({ valid: false, message: "Database error" });
        }
        
        if (results.length === 0) {
          return res.json({ valid: false, message: "User not found or not verified" });
        }
        
        res.json({
          valid: true,
          user: { ...results[0], isAdmin: isAdminEmail(results[0].email) }
        });

      }
    );
  } catch (err) {
    res.json({ valid: false, message: "Invalid or expired token" });
  }
});

module.exports = router;