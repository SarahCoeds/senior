import React, { useState } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import "../style/Checkout.css";

const CheckoutPage = () => {
  const { cart } = useCart();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  const handleNext = () => {
    if (!fullName || !phone || !address || !city) {
      return alert("Please fill in all required fields");
    }

    // Save delivery info in localStorage or context
    localStorage.setItem(
      "delivery",
      JSON.stringify({ fullName, phone, address, city, notes })
    );

    navigate("/payment");
  };

  return (
    <div className="checkout-page">
      <h2>Checkout - Delivery Details</h2>

      <div className="checkout-box">
        {cart.map(item => (
          <div className="checkout-item" key={item.id}>
            <span>{item.name} × {item.quantity}</span>
            <span>${(Number(item.price) * item.quantity).toFixed(2)}</span>
          </div>
        ))}

        <h3>Delivery Details</h3>
        <div className="checkout-form">
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="form-group">
            <label>City</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button className="primary-btn" onClick={handleNext}>
            Proceed to Payment
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
