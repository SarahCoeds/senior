const express = require("express");
const db = require("../config/db");
const bcrypt = require("bcrypt");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Small helper: run a query and return a safe default if it fails
function querySafe(sql, params = [], fallbackValue, cb) {
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("ADMIN DB ERROR:", {
        code: err.code,
        message: err.sqlMessage,
        sql,
      });
      return cb(null, fallbackValue);
    }
    cb(null, results);
  });
}

/**
 * GET /api/admin/stats (admin)
 * Returns totals for products, orders, users + recent items.
 */
router.get("/stats", requireAuth, requireAdmin, (req, res) => {
  const stats = {
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    recentProducts: [],
    recentOrders: [],
  };

  querySafe("SELECT COUNT(*) AS c FROM products", [], [{ c: 0 }], (e1, r1) => {
    stats.totalProducts = r1?.[0]?.c ?? 0;

    querySafe("SELECT COUNT(*) AS c FROM orders", [], [{ c: 0 }], (e2, r2) => {
      stats.totalOrders = r2?.[0]?.c ?? 0;

      querySafe("SELECT COUNT(*) AS c FROM users", [], [{ c: 0 }], (e3, r3) => {
        stats.totalUsers = r3?.[0]?.c ?? 0;

        querySafe("SELECT * FROM products ORDER BY id DESC LIMIT 5", [], [], (e4, r4) => {
          stats.recentProducts = r4 || [];

          querySafe("SELECT * FROM orders ORDER BY id DESC LIMIT 5", [], [], (e5, r5) => {
            stats.recentOrders = r5 || [];
            return res.json(stats);
          });
        });
      });
    });
  });
});

/**
 * GET /api/admin/users (admin)
 */
router.get("/users", requireAuth, requireAdmin, (req, res) => {
  db.query(
    "SELECT id, name, email, is_verified, created_at, updated_at FROM users ORDER BY id DESC",
    (err, results) => {
      if (err) {
        console.error("ADMIN USERS ERROR:", err);
        return res.status(500).json({ message: "Database error" });
      }
      res.json(results);
    }
  );
});

/**
 * POST /api/admin/users (admin)
 * Create user from admin dashboard.
 * Requires: name, email, password
 * Optional: is_verified (default 1 for demo)
 */
router.post("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, is_verified } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, password required" });
    }

    // prevent duplicates
    db.query("SELECT id FROM users WHERE email = ?", [email], async (checkErr, rows) => {
      if (checkErr) {
        console.error("ADMIN CREATE USER CHECK ERROR:", checkErr);
        return res.status(500).json({ message: "Database error" });
      }
      if (rows.length > 0) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(String(password), 10);

      // For admin-created users, we typically mark verified = 1 so they can login immediately
      const verified = is_verified === 0 ? 0 : 1;

      db.query(
        "INSERT INTO users (name, email, password, is_verified) VALUES (?, ?, ?, ?)",
        [String(name).trim(), String(email).trim(), hashedPassword, verified],
        (insErr, result) => {
          if (insErr) {
            console.error("ADMIN CREATE USER INSERT ERROR:", insErr);
            return res.status(500).json({ message: "Failed to create user" });
          }
          res.status(201).json({ message: "User created", id: result.insertId });
        }
      );
    });
  } catch (e) {
    console.error("ADMIN CREATE USER ERROR:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE /api/admin/users/:id (admin)
 */
router.delete("/users/:id", requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id;

  // Safety: don't let admin delete themselves (optional but smart for demo)
  if (String(req.user?.id) === String(id)) {
    return res.status(400).json({ message: "You cannot delete your own account." });
  }

  db.query("DELETE FROM users WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("ADMIN DELETE USER ERROR:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  });
});

/**
 * GET /api/admin/orders (admin)
 */
router.get("/orders", requireAuth, requireAdmin, (req, res) => {
  db.query(
    "SELECT id, user_id, total, status, created FROM orders ORDER BY id DESC",
    (err, results) => {
      if (err) {
        console.error("ADMIN ORDERS ERROR:", err);
        return res.status(500).json({ message: "Database error" });
      }
      res.json(results);
    }
  );
});

module.exports = router;
