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


function RefreshBehavior() {
  const { startNewChatOnRefresh } = useChatStore();

  useEffect(() => {

    startNewChatOnRefresh();

  }, []);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <ChatStoreProvider>

            <RefreshBehavior />

            <Router>
              <div className="app-container">
                <Header />

                <div className="main-content">
                  <Routes>

                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/payment" element={<PaymentPage />} />
                    <Route path="/track/:id" element={<TrackOrderPage />} />

                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />

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
