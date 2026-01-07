require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const orderRoutes = require("./routes/orders");
const orderMailerRoutes = require("./orderMailer");
const productsRoutes = require("./routes/products");
const adminRoutes = require("./routes/admin"); // ✅ ADD THIS

const { requireAuth, requireAdmin } = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/orders", orderMailerRoutes);
app.use("/api/products", productsRoutes);

// ✅ Mount admin routes so /api/admin/stats works
app.use("/api/admin", adminRoutes);

// quick admin test (optional)
app.get("/api/admin/test", requireAuth, requireAdmin, (req, res) => {
  res.json({ ok: true, message: "You are an admin!", user: req.user });
});

app.listen(5000, () => console.log("Server running on port 5000"));
