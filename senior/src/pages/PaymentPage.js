import React, { useState } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import "../style/PaymentPage.css";

const PaymentPage = () => {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();

  const delivery = JSON.parse(localStorage.getItem("delivery")) || {};
  const user = JSON.parse(localStorage.getItem("user"));

  const [paymentMethod, setPaymentMethod] = useState("card");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState("error");

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  const displayNotification = (message, type = "error") => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 4000);
  };

  const closeNotification = () => setShowNotification(false);

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0; i < match.length; i += 4) parts.push(match.substring(i, i + 4));
    return parts.length ? parts.join(" ") : value;
  };

  const handleCardNumberChange = (e) => setCardNumber(formatCardNumber(e.target.value));

  const formatExpiry = (value) => {
    const v = value.replace(/[^0-9]/g, "");
    return v.length >= 2 ? `${v.substring(0, 2)}/${v.substring(2, 4)}` : v;
  };

  const handleExpiryChange = (e) => setExpiry(formatExpiry(e.target.value));
  const handleCVVChange = (e) => setCvv(e.target.value.replace(/[^0-9]/g, ""));

  const handlePlaceOrder = async () => {
    if (!user) {
      displayNotification("Please log in to continue with your purchase", "warning");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }

    if (cart.length === 0) {
      displayNotification("Your cart is empty! Add items before proceeding.", "error");
      return;
    }

    if (paymentMethod === "card") {
      const cleanCardNumber = cardNumber.replace(/\s/g, "");
      if (!cardNumber || !expiry || !cvv) {
        displayNotification("Please fill in all card details", "error");
        return;
      }
      if (!/^\d{16}$/.test(cleanCardNumber)) {
        displayNotification("Card number must be 16 digits", "error");
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(expiry)) {
        displayNotification("Expiry date must be in MM/YY format", "error");
        return;
      }
      if (!/^\d{3}$/.test(cvv)) {
        displayNotification("CVV must be 3 digits", "error");
        return;
      }
    }

    setIsProcessing(true);

    try {

      const res = await fetch("http://localhost:5000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          cart,
          delivery,
          paymentMethod,
          cardInfo:
            paymentMethod === "card"
              ? {
                  cardNumber: cardNumber.replace(/\s/g, ""),
                  expiry,
                  cvv,
                }
              : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        displayNotification(data.message || "Failed to place order. Please try again.", "error");
        return;
      }

      const orderId = data.orderId;


      clearCart();
      localStorage.removeItem("delivery");

      displayNotification("Order placed successfully! Redirecting to tracking…", "success");

      setTimeout(() => {
        if (orderId) {
          navigate(`/track/${orderId}`);
        } else {

          navigate("/products");
        }
      }, 1200);
    } catch (err) {
      console.error(err);
      displayNotification("Server error. Please check your connection and try again.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="payment-page">
      <div className="payment-container">
        <div className="payment-header">
          <h1>Complete Your Payment</h1>
          <p className="payment-subtitle">Secure and encrypted payment process</p>
        </div>

        <div className="payment-layout">
          <div className="order-summary-section">
            <div className="summary-card">
              <h2>Order Summary</h2>
              <div className="summary-items">
                {cart.map((item) => (
                  <div className="summary-item" key={item.id}>
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-quantity">× {item.quantity}</span>
                    </div>
                    <span className="item-price">${(Number(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {delivery.address && (
                <div className="delivery-info">
                  <h3>Delivery Address</h3>
                  <p>
                    {delivery.address}, {delivery.city}, {delivery.zipCode}
                  </p>
                  <p>{delivery.phone}</p>
                </div>
              )}

              <div className="summary-total">
                <div className="total-row">
                  <span>Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="total-row grand-total">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="payment-section">
            <div className="payment-methods-card">
              <h2>Select Payment Method</h2>
              <div className="payment-methods">
                {/* Card Option */}
                <div
                  className={`payment-method ${paymentMethod === "card" ? "active" : ""}`}
                  onClick={() => setPaymentMethod("card")}
                >
                  <div className="method-header">
                    <input
                      type="radio"
                      id="card"
                      name="payment"
                      checked={paymentMethod === "card"}
                      onChange={() => setPaymentMethod("card")}
                    />
                    <label htmlFor="card">
                      <div className="method-icon">💳</div>
                      <div className="method-info">
                        <span className="method-title">Credit/Debit Card</span>
                        <span className="method-description">Pay with your card</span>
                      </div>
                    </label>
                  </div>
                  {paymentMethod === "card" && (
                    <div className="method-details">
                      <div className="card-icons">
                        <span className="card-icon">VISA</span>
                        <span className="card-icon">MC</span>
                        <span className="card-icon">AMEX</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* COD Option */}
                <div
                  className={`payment-method ${paymentMethod === "cod" ? "active" : ""}`}
                  onClick={() => setPaymentMethod("cod")}
                >
                  <div className="method-header">
                    <input
                      type="radio"
                      id="cod"
                      name="payment"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                    />
                    <label htmlFor="cod">
                      <div className="method-icon">💰</div>
                      <div className="method-info">
                        <span className="method-title">Cash on Delivery</span>
                        <span className="method-description">Pay when you receive</span>
                      </div>
                    </label>
                  </div>
                  {paymentMethod === "cod" && (
                    <div className="method-details">
                      <p className="cod-note">
                        You'll pay cash when your order arrives. No need to enter payment details now.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {paymentMethod === "card" && (
                <div className="card-details">
                  <h3>Card Details</h3>
                  <div className="form-group">
                    <label htmlFor="cardNumber">Card Number</label>
                    <div className="input-with-icon">
                      <input
                        id="cardNumber"
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        maxLength={19}
                      />
                      <span className="input-icon">💳</span>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="expiry">Expiry Date</label>
                      <input
                        id="expiry"
                        type="text"
                        placeholder="MM/YY"
                        value={expiry}
                        onChange={handleExpiryChange}
                        maxLength={5}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="cvv">CVV</label>
                      <div className="input-with-icon">
                        <input
                          id="cvv"
                          type="password"
                          placeholder="123"
                          value={cvv}
                          onChange={handleCVVChange}
                          maxLength={3}
                        />
                        <span className="input-icon">🔒</span>
                      </div>
                      <span className="hint">3 digits on back of card</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="security-note">
                <span className="lock-icon">🔒</span>Your payment information is encrypted and secure
              </div>

              <button
                className={`place-order-btn ${isProcessing ? "processing" : ""}`}
                onClick={handlePlaceOrder}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner"></span>Processing...
                  </>
                ) : (
                  `Place Order - $${total.toFixed(2)}`
                )}
              </button>
            </div>
          </div>
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

export default PaymentPage;
