const express = require("express");
const db = require("../config/db");
const router = express.Router();


const ALLOWED_STATUSES = ["processing", "packaged", "shipped", "out-for-delivery", "delivered"];

function normalizeStatus(status) {
  if (!status) return "processing";
  const s = String(status).toLowerCase();


  if (s === "pending") return "processing";
  if (s === "on_the_way") return "shipped";
  if (s === "outfordelivery") return "out-for-delivery";

  return ALLOWED_STATUSES.includes(s) ? s : "processing";
}

router.post("/", (req, res) => {
  const { userId, cart, delivery, paymentMethod } = req.body;

  if (!userId || !cart || cart.length === 0 || !delivery) {
    return res.status(400).json({ message: "Invalid order data" });
  }

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );


  const initialStatus = "processing";

  db.query(
    "INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)",
    [userId, total, initialStatus],
    (err, orderResult) => {
      if (err) {
        console.error("Order Insert Error:", err);
        return res.status(500).json({ message: "Failed to create order" });
      }

      const orderId = orderResult.insertId;


      const itemsQuery = `
        INSERT INTO order_items 
        (order_id, user_id, product_id, quantity, price) 
        VALUES ?
      `;
      const itemsValues = cart.map(item => [
        orderId,
        userId,
        item.id,
        item.quantity,
        Number(item.price)
      ]);

      db.query(itemsQuery, [itemsValues], (err2) => {
        if (err2) {
          console.error("Order Items Error:", err2);
          return res.status(500).json({ message: "Failed to save items" });
        }


        const { fullName, phone, address, city, zipCode, notes, email } = delivery;

        db.query(
          `
          INSERT INTO delivery_details 
          (order_id, full_name, phone, address, city, notes) 
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [orderId, fullName, phone, address, city, notes || ""],
          (err3) => {
            if (err3) {
              console.error("Delivery Details Error:", err3);
              return res.status(500).json({ message: "Failed to save delivery info" });
            }

            try {
              const axios = require("axios");
              axios.post("http://localhost:5000/api/orders/send-order-email", {
                userEmail: email,
                orderDetails: {
                  items: cart,
                  total,
                  status: initialStatus,
                  delivery,
                  paymentMethod,
                  orderId
                }
              }).catch(err => console.error("Email send error:", err));
            } catch (e) {
              console.error("Axios require/send error:", e);
            }

            res.status(201).json({
              message: "Order placed successfully",
              orderId
            });
          }
        );
      });
    }
  );
});


router.get("/:id", (req, res) => {
  const orderId = req.params.id;

  const sql = `
    SELECT 
      o.id,
      o.user_id,
      o.total,
      o.status,
      o.created,
      d.full_name,
      d.phone,
      d.address,
      d.city,
      d.notes
    FROM orders o
    LEFT JOIN delivery_details d ON d.order_id = o.id
    WHERE o.id = ?
    LIMIT 1
  `;

  db.query(sql, [orderId], (err, results) => {
    if (err) {
      console.error("Get Order Error:", err);


      const sqlFallback = `
        SELECT 
          o.id,
          o.user_id,
          o.total,
          o.status,
          o.created,
          d.full_name,
          d.phone,
          d.address,
          d.city,
          d.notes
        FROM orders o
        LEFT JOIN delivery_details d ON d.order_id = o.id
        WHERE o.id = ?
        LIMIT 1
      `;

      return db.query(sqlFallback, [orderId], (err2, results2) => {
        if (err2) {
          console.error("Get Order Fallback Error:", err2);
          return res.status(500).json({ message: "Failed to fetch order" });
        }

        if (!results2 || results2.length === 0) {
          return res.status(404).json({ message: "Order not found" });
        }

        const row = results2[0];
        res.json({
          id: row.id,
          userId: row.user_id,
          total: row.total ?? 0,
          status: normalizeStatus(row.status),
          created: row.created || null,
          delivery: {
            fullName: row.full_name || "",
            phone: row.phone || "",
            address: row.address || "",
            city: row.city || "",
            notes: row.notes || ""
          }
        });
      });
    }

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const row = results[0];

    res.json({
      id: row.id,
      userId: row.user_id,
      total: row.total ?? 0,
      status: normalizeStatus(row.status),
      created: row.created_at || null,
      delivery: {
        fullName: row.full_name || "",
        phone: row.phone || "",
        address: row.address || "",
        city: row.city || "",
        notes: row.notes || ""
      }
    });
  });
});


router.patch("/:id/status", (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  const next = normalizeStatus(status);

  if (!ALLOWED_STATUSES.includes(next)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  db.query(
    "UPDATE orders SET status = ? WHERE id = ?",
    [next, orderId],
    (err, result) => {
      if (err) {
        console.error("Update Status Error:", err);
        return res.status(500).json({ message: "Failed to update status" });
      }
      if (!result || result.affectedRows === 0) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json({ message: "Status updated", orderId, status: next });
    }
  );
});

module.exports = router;
