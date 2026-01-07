const express = require("express");
const router = express.Router();
const transporter = require("./config/mailer");

router.post("/send-order-email", async (req, res) => {
  const { userEmail, orderDetails } = req.body;

  if (!userEmail || !orderDetails) {
    return res.status(400).json({ message: "Missing email or order details" });
  }

  try {
    const html = `
      <h2>Thank you for your order!</h2>
      <p>Here’s a summary of your purchase:</p>
      <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
        <thead>
          <tr>
            <th>Image</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          ${orderDetails.items.map(item => `
            <tr>
              <td>${item.image ? `<img src="${item.image}" width="50"/>` : 'No image'}</td>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p><strong>Total:</strong> $${orderDetails.total.toFixed(2)}</p>
      <p><strong>Order Status:</strong> ${orderDetails.status}</p>
      <p>
        Track your order: 
        <a href="http://localhost:3000/track/${orderDetails.orderId}">Click here</a>
      </p>
      <p><strong>Delivery Details:</strong><br/>
        ${orderDetails.delivery.fullName || 'N/A'}<br/>
        ${orderDetails.delivery.address || 'N/A'}<br/>
        ${orderDetails.delivery.city || ''}, ${orderDetails.delivery.zipCode || ''}<br/>
        ${orderDetails.delivery.phone || 'N/A'}
      </p>
      <p><strong>Payment Method:</strong> ${orderDetails.paymentMethod}</p>
      <h3>Thank you for shopping with us!</h3>
    `;

    await transporter.sendMail({
      from: `"PC Builder Store" <${process.env.EMAIL}>`,
      to: userEmail,
      subject: "Order Confirmation - PC Builder Store",
      html
    });

    res.status(200).json({ message: "Order confirmation email sent" });
  } catch (err) {
    console.error("Email send error:", err);
    res.status(500).json({ message: "Failed to send email" });
  }
});

module.exports = router;
