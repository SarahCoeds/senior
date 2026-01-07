import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { ChatStoreProvider, useChatStore } from "./context/ChatStore";
import { NotificationProvider } from "./components/NotificationProvider";
import ProtectedRoute from "./components/ProtectedRoute";

import "./style/App.css";
import Header from "./pages/Header";
import Footer from "./pages/Footer";
import Home from "./pages/Home";
import Build from "./pages/Build";
import About from "./pages/About";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/SignupPage";
import Products from "./pages/Products";
import Cart from "./pages/Cart";
import CheckoutPage from "./pages/CheckoutPage";
import AiAssistant from "./components/AiAssistant";
import PaymentPage from "./pages/PaymentPage";
import TrackOrderPage from "./pages/TrackOrderPage";
import AdminDashboard from "./pages/AdminDashboard";
import { useEffect } from "react";

/**
 * OPTIONAL refresh behavior:
 * - If enabled: every full page refresh starts a new chat,
 *   but previous conversation remains in history.
 *
 * If you do NOT want this, delete this component entirely.
 */
function RefreshBehavior() {
  const { startNewChatOnRefresh } = useChatStore();

  useEffect(() => {
    // Comment this out if you want refresh to continue same conversation
    startNewChatOnRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <ChatStoreProvider>
            {/* OPTIONAL: refresh behavior */}
            <RefreshBehavior />

            <Router>
              <div className="app-container">
                <Header />

                <div className="main-content">
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/payment" element={<PaymentPage />} />

                    {/* Track order (public or protected: your choice; leaving public) */}
                    <Route path="/track/:id" element={<TrackOrderPage />} />

                    {/* Admin Route */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* Protected Routes */}
                    <Route
                      path="/build"
                      element={
                        <ProtectedRoute>
                          <Build />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/ai"
                      element={
                        <ProtectedRoute>
                          <AiAssistant />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/checkout"
                      element={
                        <ProtectedRoute>
                          <CheckoutPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Redirect any unknown routes to home */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>

                <Footer />
              </div>
            </Router>
          </ChatStoreProvider>
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
