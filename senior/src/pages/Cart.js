import React, { useMemo, useState } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import Notification from "../components/Notification";
import "../style/Cart.css";

const CartPage = () => {
  const navigate = useNavigate();
  const { cart, removeFromCart, updateQuantity, clearCart } = useCart();

  const [notification, setNotification] = useState(null);

  const total = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );
  }, [cart]);

  const handleClearCart = () => {
    if (cart.length === 0) return;

    setNotification({
      type: "warning",
      message: "Are you sure you want to clear your cart?",
      actionLabel: "Yes, clear",
      onAction: () => {
        clearCart();
        setNotification({
          type: "success",
          message: "Cart cleared successfully.",
        });
      },
    });
  };

  return (
    <div className="cart-page">
      {/* Notification Stack (top-right) */}
      <div className="notification-stack">
        {notification && (
          <div className="notification-with-action">
            <Notification
              type={notification.type}
              message={notification.message}
              onClose={() => setNotification(null)}
            />

            {notification.actionLabel && (
              <div className="notif-actions">
                <button
                  className="notif-action-btn"
                  onClick={() => setNotification(null)}
                >
                  Cancel
                </button>

                <button
                  className="notif-action-btn danger"
                  onClick={() => {
                    notification.onAction?.();
                  }}
                >
                  {notification.actionLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <h2>Your Cart</h2>

      {cart.length === 0 ? (
        <p className="empty">Your cart is empty.</p>
      ) : (
        <div className="cart-grid">
          {cart.map((item) => (
            <div className="cart-item" key={item.id}>
              <img
                src={`http://localhost:5000/uploads/products/${item.image}`}
                alt={item.name}
                className="cart-image"
              />

              <div className="cart-info">
                <h3>{item.name}</h3>
                <p>${Number(item.price).toFixed(2)}</p>

                <div className="quantity">
                  <label>Qty:</label>
                  <input
                    type="number"
                    value={item.quantity}
                    min={1}
                    onChange={(e) =>
                      updateQuantity(item.id, Number(e.target.value))
                    }
                  />
                </div>

                <button
                  className="remove-btn"
                  onClick={() => removeFromCart(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <>
          <h3 className="cart-total">Total: ${total.toFixed(2)}</h3>

          <div className="cart-actions">
            <button className="clear-cart-btn" onClick={handleClearCart}>
              Clear Cart
            </button>

            <button
              className="checkout-btn"
              onClick={() => navigate("/checkout")}
            >
              Proceed to Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CartPage;
