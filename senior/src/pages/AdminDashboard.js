import React, { useEffect, useMemo, useState } from "react";
import "../style/AdminDashboard.css";
import { useNotify } from "../components/NotificationProvider";
import ConfirmModal from "../components/ConfirmModal";

const API_BASE = "http://localhost:5000";

function getToken() {
  return localStorage.getItem("token");
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

const STATUS_OPTIONS = [
  { value: "processing", label: "Processing" },
  { value: "packaged", label: "Packaged" },
  { value: "shipped", label: "Shipped" },
  { value: "out-for-delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
];

const CATEGORY_OPTIONS = ["parts", "laptop", "prebuilt", "accessory"];

export default function AdminDashboard() {
  const notify = useNotify();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  const [active, setActive] = useState("overview"); 
  const [stats, setStats] = useState(null);

  const [products, setProducts] = useState([]);
  const [productQuery, setProductQuery] = useState("");

  const [orders, setOrders] = useState([]);
  const [orderQuery, setOrderQuery] = useState("");

  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState("");


  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    category: "parts",
    image: "",
    description: "",
  });


  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    is_verified: 1,
  });

  const [orderUpdatingId, setOrderUpdatingId] = useState(null);
  const [globalError, setGlobalError] = useState("");

  const [confirm, setConfirm] = useState({
    open: false,
    title: "",
    message: "",
    tone: "danger",
    confirmText: "Confirm",
    onConfirm: null,
  });

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const category = String(p.category || "").toLowerCase();
      return name.includes(q) || category.includes(q);
    });
  }, [products, productQuery]);

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const id = String(o.id || "");
      const userId = String(o.user_id || "");
      const status = String(o.status || "").toLowerCase();
      return id.includes(q) || userId.includes(q) || status.includes(q);
    });
  }, [orders, orderQuery]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = String(u.name || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      const id = String(u.id || "");
      return name.includes(q) || email.includes(q) || id.includes(q);
    });
  }, [users, userQuery]);

  async function refreshStats() {
    const s = await api("/api/admin/stats");
    setStats(s);
  }

  async function loadProducts() {
    const p = await api("/api/products");
    setProducts(p);
  }

  async function loadOrders() {
    const o = await api("/api/admin/orders");
    setOrders(o);
  }

  async function loadUsers() {
    const u = await api("/api/admin/users");
    setUsers(u);
  }

  async function refreshAll() {
    setGlobalError("");
    await Promise.all([refreshStats(), loadProducts(), loadOrders(), loadUsers()]);
    notify.success("Dashboard refreshed.");
  }

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);

        const token = getToken();
        if (!token) throw new Error("Missing token. Please login.");

        const vt = await fetch(`${API_BASE}/api/auth/validate-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).then((r) => r.json());

        if (!vt.valid) throw new Error(vt.message || "Invalid token");
        if (!vt.user?.isAdmin) throw new Error("You are not an admin.");

        setMe(vt.user);

        await Promise.all([refreshStats(), loadProducts(), loadOrders(), loadUsers()]);
      } catch (e) {
        notify.error(e.message || "Auth failed.");
        setTimeout(() => {
          window.location.href = "/";
        }, 600);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  function openAddProduct() {
    setEditingProduct(null);
    setProductForm({
      name: "",
      price: "",
      category: "parts",
      image: "",
      description: "",
    });
    setProductModalOpen(true);
  }

  function openEditProduct(p) {
    setEditingProduct(p);
    setProductForm({
      name: p.name ?? "",
      price: p.price ?? "",
      category: p.category ?? "parts",
      image: p.image ?? "",
      description: p.description ?? "",
    });
    setProductModalOpen(true);
  }

  async function saveProduct() {
    setGlobalError("");

    const payload = {
      name: String(productForm.name || "").trim(),
      price: Number(productForm.price),
      category: String(productForm.category || "").trim(),
      image: String(productForm.image || "").trim() || null,
      description: String(productForm.description || "").trim() || null,
    };

    if (!payload.name || Number.isNaN(payload.price) || !payload.category) {
      notify.warning("Name, price, and category are required.");
      return;
    }

    try {
      if (editingProduct) {
        await api(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notify.success("Product updated.");
      } else {
        await api(`/api/products`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notify.success("Product created.");
      }

      await loadProducts();
      await refreshStats();
      setProductModalOpen(false);
    } catch (e) {
      setGlobalError(e.message);
      notify.error(e.message);
    }
  }

  function askRemoveProduct(id) {
    setConfirm({
      open: true,
      title: "Delete product",
      message: "This will permanently delete the product.",
      tone: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await api(`/api/products/${id}`, { method: "DELETE" });
          setProducts((prev) => prev.filter((p) => p.id !== id));
          await refreshStats();
          notify.success("Product deleted.");
        } catch (e) {
          setGlobalError(e.message);
          notify.error(e.message);
        } finally {
          setConfirm((p) => ({ ...p, open: false }));
        }
      },
    });
  }

  async function updateOrderStatus(orderId, nextStatus) {
    try {
      setOrderUpdatingId(orderId);
      await api(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadOrders();
      await refreshStats();
      notify.success(`Order #${orderId} updated.`);
    } catch (e) {
      setGlobalError(e.message);
      notify.error(e.message);
    } finally {
      setOrderUpdatingId(null);
    }
  }

  function openAddUser() {
    setUserForm({
      name: "",
      email: "",
      password: "",
      is_verified: 1,
    });
    setUserModalOpen(true);
  }

  async function createUser() {
    setGlobalError("");

    const payload = {
      name: String(userForm.name || "").trim(),
      email: String(userForm.email || "").trim(),
      password: String(userForm.password || ""),
      is_verified: Number(userForm.is_verified) === 0 ? 0 : 1,
    };

    if (!payload.name || !payload.email || !payload.password) {
      notify.warning("Name, email, and password are required.");
      return;
    }

    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await loadUsers();
      await refreshStats();
      setUserModalOpen(false);
      notify.success("User created.");
    } catch (e) {
      setGlobalError(e.message);
      notify.error(e.message);
    }
  }

  function askDeleteUser(userId) {
    if (String(me?.id) === String(userId)) {
      notify.warning("You cannot delete your own admin account.");
      return;
    }

    setConfirm({
      open: true,
      title: "Delete user",
      message: "This will permanently delete the user account.",
      tone: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await api(`/api/admin/users/${userId}`, { method: "DELETE" });
          await loadUsers();
          await refreshStats();
          notify.success("User deleted.");
        } catch (e) {
          setGlobalError(e.message);
          notify.error(e.message);
        } finally {
          setConfirm((p) => ({ ...p, open: false }));
        }
      },
    });
  }

  if (loading) return <div className="ad-loading">Loading admin dashboard…</div>;

  const recentOrders = (stats?.recentOrders || []).slice(0, 5);

  return (
    <div className="ad-page">
      <aside className="ad-sidebar">
        <div className="ad-brand">
          <div className="ad-brand-title">Admin Panel</div>
          <div className="ad-brand-sub">Management Console</div>
        </div>

        <div className="ad-profile">
          <div className="ad-profile-name">{me?.name || "Admin"}</div>
          <div className="ad-profile-email">{me?.email || ""}</div>
        </div>

        <nav className="ad-nav">
          <button className={`ad-nav-item ${active === "overview" ? "active" : ""}`} onClick={() => setActive("overview")}>
            Overview
          </button>
          <button className={`ad-nav-item ${active === "orders" ? "active" : ""}`} onClick={() => setActive("orders")}>
            Orders
          </button>
          <button className={`ad-nav-item ${active === "products" ? "active" : ""}`} onClick={() => setActive("products")}>
            Products
          </button>
          <button className={`ad-nav-item ${active === "users" ? "active" : ""}`} onClick={() => setActive("users")}>
            Users
          </button>
        </nav>

        <div className="ad-actions">
          <button className="ad-btn ad-btn-primary" onClick={openAddProduct}>
            Add Product
          </button>
          <button className="ad-btn ad-btn-secondary" onClick={refreshAll}>
            Refresh Data
          </button>
        </div>

        {globalError ? <div className="ad-error">{globalError}</div> : null}
      </aside>

      <main className="ad-main">
        <div className="ad-topbar">
          <div>
            <div className="ad-title">
              {active === "overview"
                ? "Dashboard"
                : active === "orders"
                ? "All Orders"
                : active === "products"
                ? "All Products"
                : "All Users"}
            </div>
            <div className="ad-subtitle">
              {active === "overview"
                ? "Quick overview of your store."
                : active === "orders"
                ? "Manage and update order delivery statuses."
                : active === "products"
                ? "Create, edit, and delete products."
                : "Create and remove user accounts."}
            </div>
          </div>

          <div className="ad-topbar-right">
            <div className="ad-pill">Connected: Database</div>
          </div>
        </div>

        {active === "overview" && (
          <>
            <div className="ad-metrics">
              <div className="ad-metric">
                <div className="ad-metric-label">Total Products</div>
                <div className="ad-metric-value">{stats?.totalProducts ?? 0}</div>
              </div>
              <div className="ad-metric">
                <div className="ad-metric-label">Total Orders</div>
                <div className="ad-metric-value">{stats?.totalOrders ?? 0}</div>
              </div>
              <div className="ad-metric">
                <div className="ad-metric-label">Total Users</div>
                <div className="ad-metric-value">{stats?.totalUsers ?? 0}</div>
              </div>
            </div>

            <div className="ad-section">
              <div className="ad-section-header">
                <div className="ad-section-title">Recent Orders</div>
                <button className="ad-btn ad-btn-light" onClick={() => setActive("orders")}>
                  View all
                </button>
              </div>

              <div className="ad-section-body">
                <div className="ad-tablewrap">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th style={{ width: 260 }}>Update</th>
                        <th>Track</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((o) => (
                        <tr key={o.id}>
                          <td>{o.id}</td>
                          <td>{o.user_id ?? "-"}</td>
                          <td>{Number(o.total ?? 0).toFixed(2)}</td>
                          <td>{o.status ?? "-"}</td>
                          <td>
                            <select
                              className="ad-select"
                              value={o.status || "processing"}
                              onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                              disabled={orderUpdatingId === o.id}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                            {orderUpdatingId === o.id ? <span className="ad-muted">Updating…</span> : null}
                          </td>
                          <td>
                            <a className="ad-link" href={`/track/${o.id}`}>
                              Open
                            </a>
                          </td>
                        </tr>
                      ))}

                      {recentOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="ad-empty">
                            No recent orders found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {active === "orders" && (
          <div className="ad-section">
            <div className="ad-section-header">
              <div className="ad-section-title">Orders</div>
              <input
                className="ad-search"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="Search by id, user, status"
              />
            </div>

            <div className="ad-section-body">
              <div className="ad-tablewrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>User</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th style={{ width: 260 }}>Update Status</th>
                      <th>Track</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>{o.user_id ?? "-"}</td>
                        <td>{Number(o.total ?? 0).toFixed(2)}</td>
                        <td>{o.status ?? "-"}</td>
                        <td>
                          <select
                            className="ad-select"
                            value={o.status || "processing"}
                            onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                            disabled={orderUpdatingId === o.id}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          {orderUpdatingId === o.id ? <span className="ad-muted">Updating…</span> : null}
                        </td>
                        <td>
                          <a className="ad-link" href={`/track/${o.id}`}>
                            Open
                          </a>
                        </td>
                      </tr>
                    ))}

                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="ad-empty">
                          No orders found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {active === "products" && (
          <div className="ad-section">
            <div className="ad-section-header">
              <div className="ad-section-title">Products</div>
              <div className="ad-right">
                <input
                  className="ad-search"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Search name or category"
                />
                <button className="ad-btn ad-btn-primary" onClick={openAddProduct}>
                  Add Product
                </button>
              </div>
            </div>

            <div className="ad-section-body">
              <div className="ad-tablewrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th style={{ width: 240 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td>{p.name}</td>
                        <td>{p.category}</td>
                        <td>{Number(p.price ?? 0).toFixed(2)}</td>
                        <td>
                          <button className="ad-btn ad-btn-light" onClick={() => openEditProduct(p)}>
                            Edit
                          </button>
                          <button className="ad-btn ad-btn-danger" onClick={() => askRemoveProduct(p.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="ad-empty">
                          No products found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {active === "users" && (
          <div className="ad-section">
            <div className="ad-section-header">
              <div className="ad-section-title">Users</div>
              <div className="ad-right">
                <input
                  className="ad-search"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search id, name, email"
                />
                <button className="ad-btn ad-btn-primary" onClick={openAddUser}>
                  Add User
                </button>
              </div>
            </div>

            <div className="ad-section-body">
              <div className="ad-tablewrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Verified</th>
                      <th>Created</th>
                      <th style={{ width: 160 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.name || "-"}</td>
                        <td>{u.email || "-"}</td>
                        <td>{u.is_verified ? "Yes" : "No"}</td>
                        <td>{u.created_at ? String(u.created_at).slice(0, 10) : "-"}</td>
                        <td>
                          <button
                            className="ad-btn ad-btn-danger"
                            onClick={() => askDeleteUser(u.id)}
                            disabled={String(me?.id) === String(u.id)}
                            title={String(me?.id) === String(u.id) ? "You cannot delete your own account." : ""}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="ad-empty">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ad-footnote">
                Admin-created users are stored in the database. If Verified = Yes, they can log in immediately.
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Product Modal */}
      {productModalOpen && (
        <div className="ad-modalOverlay" onClick={() => setProductModalOpen(false)}>
          <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modalHeader">
              <div className="ad-modalTitle">{editingProduct ? "Edit Product" : "Add Product"}</div>
              <button className="ad-modalClose" onClick={() => setProductModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="ad-formGrid">
              <label className="ad-field">
                <div className="ad-label">Name</div>
                <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
              </label>

              <label className="ad-field">
                <div className="ad-label">Price</div>
                <input value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
              </label>

              <label className="ad-field">
                <div className="ad-label">Category</div>
                <select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="ad-field">
                <div className="ad-label">Image URL</div>
                <input value={productForm.image} onChange={(e) => setProductForm({ ...productForm, image: e.target.value })} />
              </label>

              <label className="ad-field ad-span2">
                <div className="ad-label">Description</div>
                <textarea
                  rows={5}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
              </label>
            </div>

            <div className="ad-modalActions">
              <button className="ad-btn ad-btn-light" onClick={() => setProductModalOpen(false)}>
                Cancel
              </button>
              <button className="ad-btn ad-btn-primary" onClick={saveProduct}>
                {editingProduct ? "Save Changes" : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {userModalOpen && (
        <div className="ad-modalOverlay" onClick={() => setUserModalOpen(false)}>
          <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modalHeader">
              <div className="ad-modalTitle">Add User</div>
              <button className="ad-modalClose" onClick={() => setUserModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="ad-formGrid">
              <label className="ad-field">
                <div className="ad-label">Name</div>
                <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
              </label>

              <label className="ad-field">
                <div className="ad-label">Email</div>
                <input value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
              </label>

              <label className="ad-field">
                <div className="ad-label">Password</div>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                />
              </label>

              <label className="ad-field">
                <div className="ad-label">Verified</div>
                <select value={userForm.is_verified} onChange={(e) => setUserForm({ ...userForm, is_verified: Number(e.target.value) })}>
                  <option value={1}>Yes</option>
                  <option value={0}>No</option>
                </select>
              </label>
            </div>

            <div className="ad-modalActions">
              <button className="ad-btn ad-btn-light" onClick={() => setUserModalOpen(false)}>
                Cancel
              </button>
              <button className="ad-btn ad-btn-primary" onClick={createUser}>
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        tone={confirm.tone}
        confirmText={confirm.confirmText}
        cancelText="Cancel"
        onCancel={() => setConfirm((p) => ({ ...p, open: false }))}
        onConfirm={() => confirm.onConfirm?.()}
      />
    </div>
  );
}
