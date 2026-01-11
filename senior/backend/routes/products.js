const express = require("express");
const db = require("../config/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const { category } = req.query;

  let sql = "SELECT * FROM products";
  const params = [];
  const where = [];

  if (category && category !== "all") {
    where.push("category = ?");
    params.push(category);
  }

  if (where.length > 0) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY id DESC";

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(results);
  });
});


router.post("/", requireAuth, requireAdmin, (req, res) => {
  const { name, price, category, image, description } = req.body;

  if (!name || price == null || !category) {
    return res.status(400).json({ message: "name, price, category required" });
  }

  const sql = `
    INSERT INTO products (name, price, category, description, image)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      String(name).trim(),
      Number(price),
      String(category).trim(),
      description ? String(description).trim() : null,
      image ? String(image).trim() : null,
    ],
    (err, result) => {
      if (err) {
        console.error("PRODUCT INSERT ERROR:", err);
        return res.status(500).json({ message: "Insert failed", error: err.code });
      }
      res.status(201).json({ message: "Created", id: result.insertId });
    }
  );
});


router.put("/:id", requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id;

  const allowed = ["name", "price", "category", "description", "image"];
  const updates = [];
  const params = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      if (key === "price") params.push(Number(req.body[key]));
      else params.push(req.body[key] === "" ? null : req.body[key]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ message: "No fields to update" });

  const sql = `UPDATE products SET ${updates.join(", ")} WHERE id = ?`;
  params.push(id);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("PRODUCT UPDATE ERROR:", err);
      return res.status(500).json({ message: "Update failed" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Updated" });
  });
});


router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM products WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("PRODUCT DELETE ERROR:", err);
      return res.status(500).json({ message: "Delete failed" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  });
});

module.exports = router;
