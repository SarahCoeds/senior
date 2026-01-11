import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaShoppingCart } from "react-icons/fa";
import "../style/Header.css";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, clearCart } = useCart();
  const { user, logout } = useAuth();

  const [showDropdown, setShowDropdown] = useState(false);

  const isActive = (path) =>
    location.pathname === path ? "nav-btn active" : "nav-btn";

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleLogout = () => {
    logout();
    clearCart();
    setShowDropdown(false);
    navigate("/");
  };

  const goAdmin = () => {
    setShowDropdown(false);
    navigate("/admin");
  };

  return (
    <header className="header">
      <div className="container">
        <h1 className="logo" onClick={() => navigate("/")}>
          Kindred PCs
        </h1>

        <nav className="nav">
          <button className={isActive("/")} onClick={() => navigate("/")}>
            Home
          </button>
          <button className={isActive("/build")} onClick={() => navigate("/build")}>
            Build a PC
          </button>
          <button className={isActive("/products")} onClick={() => navigate("/products")}>
            Products
          </button>
          <button className={isActive("/about")} onClick={() => navigate("/about")}>
            About Us
          </button>
        </nav>

        <div className="user-section">
          {!user ? (
            <button className="login-btn" onClick={() => navigate("/login")}>
              Login / Sign Up
            </button>
          ) : (
            <div className="user-dropdown">
              <div
                className="user-avatar"
                onClick={() => setShowDropdown((prev) => !prev)}
              >
                {user.name?.charAt(0)?.toUpperCase() || "U"}
                <span className="user-name">{user.name}</span>
              </div>

              {showDropdown && (
                <div className="dropdown-menu">
                  {user?.isAdmin && (
                    <button onClick={goAdmin}>Admin Dashboard</button>
                  )}

                  <button onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          )}

          <div className="cart-icon" onClick={() => navigate("/cart")}>
            <FaShoppingCart size={22} />
            {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
