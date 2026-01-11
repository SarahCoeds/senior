const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET;


function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);


    db.query(
      "SELECT id, name, email, is_verified FROM users WHERE id = ? LIMIT 1",
      [decoded.id],
      (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (results.length === 0) return res.status(401).json({ message: "User not found" });

        const user = results[0];
        if (!user.is_verified) return res.status(403).json({ message: "User not verified" });

        req.user = { id: user.id, email: user.email, name: user.name };
        next();
      }
    );
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}


function requireAdmin(req, res, next) {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  if (!req.user?.email) return res.status(401).json({ message: "Not authenticated" });

  const isAdmin = adminEmails.includes(req.user.email.toLowerCase());
  if (!isAdmin) return res.status(403).json({ message: "Admin access required" });

  next();
}

module.exports = { requireAuth, requireAdmin };
