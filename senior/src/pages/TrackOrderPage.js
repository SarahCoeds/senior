import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import "../style/TrackOrderPage.css";

const TrackOrderPage = () => {
  const { id } = useParams();

  const [order, setOrder] = useState({
    orderId: "",
    userId: "",
    status: "loading",
    total: 0,
    created: null,
    estimatedDelivery: "",
    location: "",
    delivery: null,
  });

  const [mapProgress, setMapProgress] = useState(0);
  const [showSupport, setShowSupport] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const statusConfig = useMemo(
    () => ({
      processing: {
        title: "Processing Your Order",
        description: "Your items are being prepared for shipment",
        video: "📦",
        color: "#4CAF50",
        animationClass: "package-pulse",
      },
      packaged: {
        title: "Order Packaged",
        description: "Your items have been carefully packaged",
        video: "📦📦📦",
        color: "#2196F3",
        animationClass: "package-bounce",
      },
      shipped: {
        title: "Shipped & On the Way!",
        description: "Your package is now in transit",
        video: "🚚",
        color: "#FF9800",
        animationClass: "truck-move",
      },
      "out-for-delivery": {
        title: "Out for Delivery",
        description: "Your package will arrive today!",
        video: "📭",
        color: "#9C27B0",
        animationClass: "delivery-drive",
      },
      delivered: {
        title: "Delivered!",
        description: "Your package has been delivered",
        video: "🏠✅",
        color: "#00BCD4",
        animationClass: "delivery-bounce",
      },
      loading: {
        title: "Loading...",
        description: "Fetching your order details",
        video: "⏳",
        color: "#607D8B",
        animationClass: "",
      },
    }),
    []
  );

  const statusToLocation = useMemo(
    () => ({
      processing: "Warehouse",
      packaged: "Packaging Center",
      shipped: "In Transit",
      "out-for-delivery": "Local Courier",
      delivered: "Delivered",
      loading: "Checking...",
    }),
    []
  );

  const steps = useMemo(
    () => [
      { key: "processing", label: "Processing", icon: "🧾" },
      { key: "packaged", label: "Packaged", icon: "📦" },
      { key: "shipped", label: "Shipped", icon: "🚚" },
      { key: "out-for-delivery", label: "Out for delivery", icon: "📍" },
      { key: "delivered", label: "Delivered", icon: "✅" },
    ],
    []
  );

  const progressMap = useMemo(
    () => ({
      processing: 20,
      packaged: 40,
      shipped: 60,
      "out-for-delivery": 80,
      delivered: 100,
    }),
    []
  );

  const stepIndex = useMemo(() => {
    const idx = steps.findIndex((s) => s.key === order.status);
    return idx === -1 ? 0 : idx;
  }, [order.status, steps]);

  const loadOrder = async (orderId) => {
    setErrorMsg("");

    try {
      const res = await fetch(`http://localhost:5000/api/orders/${orderId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch order");
      }

      const normalizedStatus = data.status || "processing";
      const createdDate = data.created ? new Date(data.created) : new Date();
      const estimated = new Date(createdDate);
      estimated.setDate(createdDate.getDate() + 2);

      setOrder({
        orderId: String(data.id ?? orderId),
        userId: String(data.userId ?? ""),
        status: normalizedStatus,
        total: Number(data.total ?? 0),
        created: data.created ?? createdDate.toISOString(),
        estimatedDelivery: estimated.toDateString(),
        location: statusToLocation[normalizedStatus] || "Warehouse",
        delivery: data.delivery || null,
      });

      setMapProgress(progressMap[normalizedStatus] || 20);
    } catch (err) {
      console.error(err);
      setErrorMsg(String(err.message || "Something went wrong fetching the order."));

      const createdDate = new Date();
      const estimated = new Date(createdDate);
      estimated.setDate(createdDate.getDate() + 2);

      setOrder({
        orderId: String(orderId || ""),
        userId: "",
        status: "processing",
        total: 0,
        created: createdDate.toISOString(),
        estimatedDelivery: estimated.toDateString(),
        location: "Warehouse",
        delivery: null,
      });

      setMapProgress(20);
    }
  };

  useEffect(() => {
    if (!id) {
      setErrorMsg("No order ID found in the URL. Make sure the route is /track/:id.");
      return;
    }

    loadOrder(id);

    const interval = setInterval(() => {
      loadOrder(id);
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  const currentStatus = statusConfig[order.status] || statusConfig.loading;

  const downloadInvoice = () => {
    const safeDate = order.created ? new Date(order.created) : new Date();
    const deliverySummary = order.delivery
      ? `${order.delivery.fullName || ""}\n${order.delivery.phone || ""}\n${order.delivery.address || ""}\n${order.delivery.city || ""}\nNotes: ${order.delivery.notes || ""}`
      : "N/A";

    const content = `
INVOICE
-------------------------------------------------
Order ID: ${order.orderId || id}
User ID: ${order.userId || "N/A"}
Order Total: $${Number(order.total).toFixed(2)}
Order Status: ${order.status}
Order Date: ${safeDate.toDateString()}
Estimated Delivery: ${order.estimatedDelivery}
Current Location: ${order.location}

Delivery Details:
${deliverySummary}

Thank you for your purchase!
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice_order_${order.orderId || id}.txt`;
    a.click();

    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="track-order-container">
      <div className="track-header">
        <h1 className="track-title">Track Your Order</h1>

        <p className="order-id">
          Order ID: <span className="id-highlight">{order.orderId || id || "—"}</span>
        </p>

        {order.userId ? (
          <p style={{ color: "black" }}>
            👤 User ID: <strong>{order.userId}</strong>
          </p>
        ) : null}

        <p style={{ color: "black" }}>
          💰 Order Total: <strong>${Number(order.total).toFixed(2)}</strong>
        </p>

        <p style={{ color: "#555", fontSize: 12, marginTop: 6 }}>
          Auto-updates every 5 seconds.
        </p>

        {errorMsg ? (
          <p style={{ color: "#b00020", marginTop: 10 }}>⚠️ {errorMsg}</p>
        ) : null}
      </div>

      <div className="status-card" style={{ borderColor: currentStatus.color }}>
        <div className={`status-animation ${currentStatus.animationClass || ""}`}>
          {currentStatus.video}
        </div>

        <h2 style={{ color: currentStatus.color }}>{currentStatus.title}</h2>

        <p style={{ color: "white", fontSize: "1.05rem" }}>{currentStatus.description}</p>

        <div style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 10, fontWeight: 700, color: "white" }}>
            Delivery Progress
          </div>

          <div style={{ background: "#2b2b2b", borderRadius: 999, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${mapProgress}%`, height: "100%", background: currentStatus.color }} />
          </div>

                      <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 18,
                flexWrap: "wrap",
                justifyContent: "center",   
                alignItems: "center",       
              }}
            >

            {steps.map((s, idx) => {
              const done = idx <= stepIndex;
              return (
                <div
                  key={s.key}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: done ? "#242424" : "#151515",
                    border: `1px solid ${done ? currentStatus.color : "#2f2f2f"}`,
                    opacity: done ? 1 : 0.65,
                    minWidth: 140,
                    color: "white",
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 4 }}>
                    {s.icon} <span style={{ fontWeight: 700 }}>{s.label}</span>
                  </div>

                  <div style={{ fontSize: 12, color: "white" }}>
                    {done ? (idx === stepIndex ? "Current" : "Completed") : "Pending"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 16, color: "white", fontWeight: 600 }}>
          <p style={{ color: "white" }}>📅 Estimated Delivery: {order.estimatedDelivery}</p>
          <p style={{ color: "white" }}>📍 Current Location: {order.location}</p>
        </div>
      </div>

      <div className="track-footer">
        <button className="action-btn primary" onClick={() => setShowSupport(!showSupport)}>
          Contact Support
        </button>

        <button className="action-btn secondary" onClick={() => alert("Reorder feature coming soon 🚀")}>
          Reorder Items
        </button>

        <button className="action-btn outline" onClick={downloadInvoice}>
          Download Invoice
        </button>
      </div>

      {showSupport && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "300px",
            background: "#1e1e1e",
            color: "white",
            padding: "15px",
            borderRadius: "10px",
            border: "1px solid #333",
          }}
        >
          <strong>Support</strong>
          <p>Hi! How can we help you?</p>
          <input
            placeholder="Type a message..."
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 8,
              border: "1px solid #444",
              background: "#121212",
              color: "white",
            }}
          />
        </div>
      )}
    </div>
  );
};

export default TrackOrderPage;
