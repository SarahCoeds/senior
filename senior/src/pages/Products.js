import React, { useEffect, useMemo, useState } from "react";
import { useCart } from "../context/CartContext";
import "../style/Products.css";

const CATEGORIES = [
  { label: "All Products", value: "all" },
  { label: "GPUs", value: "gpu" },
  { label: "CPUs", value: "cpu" },
  { label: "Motherboards", value: "motherboard" },
  { label: "RAM", value: "ram" },
  { label: "Storage", value: "storage" },
  { label: "Power Supplies (PSU)", value: "psu" },
  { label: "Cases", value: "case" },
  { label: "Coolers", value: "cooler" },
  { label: "Laptops", value: "laptop" },
  { label: "Prebuilt PCs", value: "prebuilt" },
  { label: "Accessories", value: "accessory" },
];

const SORTS = [
  { label: "Newest", value: "newest" },
  { label: "Price: Low → High", value: "price_asc" },
  { label: "Price: High → Low", value: "price_desc" },
  { label: "Name: A → Z", value: "name_asc" },
];

const toPrice = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const ProductsPage = () => {
  const { addToCart } = useCart();

  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [sortBy, setSortBy] = useState("name_asc");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(999999);

  const [minBound, setMinBound] = useState(0);
  const [maxBound, setMaxBound] = useState(5000);
  const [pendingOpenId, setPendingOpenId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const open = params.get("open");

    if (q) setSearch(q);
    if (open) setPendingOpenId(open);
  }, []);

  useEffect(() => {
    fetch("http://localhost:5000/api/products")
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setProducts(arr);

        const prices = arr.map((p) => toPrice(p.price)).filter((n) => n > 0);
        const minP = prices.length ? Math.floor(Math.min(...prices)) : 0;
        const maxP = prices.length ? Math.ceil(Math.max(...prices)) : 5000;

        setMinBound(minP);
        setMaxBound(maxP);
        setPriceMin(minP);
        setPriceMax(maxP);


        if (pendingOpenId != null) {
          const found = arr.find((p) => String(p.id) === String(pendingOpenId));
          if (found) {
            setSelectedProduct(found);
            document.body.style.overflow = "hidden";
          }
          setPendingOpenId(null);
        }
      })
      .catch((err) => console.error(err));

  }, [pendingOpenId]);

  const categoryLabel = useMemo(() => {
    const found = CATEGORIES.find((c) => c.value === activeCategory);
    return found ? found.label : "Products";
  }, [activeCategory]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = products.filter((p) => {
      const cat = (p.category || "").toLowerCase();
      const name = (p.name || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const price = toPrice(p.price);

      if (activeCategory !== "all" && cat !== activeCategory) return false;
      if (q && !name.includes(q) && !desc.includes(q)) return false;
      if (price < priceMin || price > priceMax) return false;

      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "newest") {
        const da = new Date(a.created || 0).getTime();
        const db = new Date(b.created || 0).getTime();
        return db - da;
      }
      if (sortBy === "price_asc") return toPrice(a.price) - toPrice(b.price);
      if (sortBy === "price_desc") return toPrice(b.price) - toPrice(a.price);
      if (sortBy === "name_asc") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }
      return 0;
    });

    return list;
  }, [products, activeCategory, search, priceMin, priceMax, sortBy]);

  const openModal = (product) => {
    setSelectedProduct(product);
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    setSelectedProduct(null);
    document.body.style.overflow = "";
  };

  const resetFilters = () => {
    setActiveCategory("all");
    setSearch("");
    setSortBy("name_asc");
    setPriceMin(minBound);
    setPriceMax(maxBound);
  };

  return (
    <div className="products-page">
      <div className="products-category-header">
        <div className="products-category-inner">
          <div className="category-title">{categoryLabel}</div>
          <div className="category-meta">
            Showing <b>{filteredProducts.length}</b> items
          </div>
        </div>
      </div>

      <div className="products-layout">
        <aside className="products-sidebar">
          <h2 className="sidebar-title">Browse</h2>

          <div className="sidebar-block">
            <label className="sidebar-label">Search</label>
            <input
              className="sidebar-search"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="sidebar-block">
            <label className="sidebar-label">Category</label>
            <select
              className="sidebar-select"
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sidebar-block">
            <label className="sidebar-label">Sort</label>
            <select
              className="sidebar-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sidebar-block">
            <label className="sidebar-label">Price Range</label>

            <div className="price-row">
              <div className="price-pill">${priceMin}</div>
              <div className="price-pill">${priceMax}</div>
            </div>

            <input
              className="range"
              type="range"
              min={minBound}
              max={maxBound}
              value={priceMin}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPriceMin(v <= priceMax ? v : priceMax);
              }}
            />
            <input
              className="range"
              type="range"
              min={minBound}
              max={maxBound}
              value={priceMax}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPriceMax(v >= priceMin ? v : priceMin);
              }}
            />

            <button className="secondary-btn full" onClick={resetFilters}>
              Reset Filters
            </button>
          </div>

          <div className="sidebar-hint">Tip: Click any product card to view details.</div>
        </aside>

        <main className="products-main">
          <div className="products-grid">
            {filteredProducts.map((product) => (
              <div
                className="product-card"
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => openModal(product)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openModal(product);
                }}
              >
                <div className="product-image-wrap">
                  <img
                    src={`http://localhost:5000/uploads/products/${product.image}`}
                    alt={product.name}
                    className="product-image"
                    onError={(e) => {
                      e.currentTarget.src = "https://via.placeholder.com/500x350?text=No+Image";
                    }}
                  />
                </div>

                <div className="product-info">
                  <div className="product-badge-row">
                    <span className="badge">{(product.category || "unknown").toUpperCase()}</span>
                  </div>

                  <h3 className="product-name">{product.name}</h3>

                  <p className="product-desc">
                    {(product.description || "").slice(0, 90)}
                    {(product.description || "").length > 90 ? "..." : ""}
                  </p>

                  <div className="product-footer">
                    <p className="product-price">${Number(product.price).toFixed(2)}</p>

                    <button
                      className="add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="empty-state">
              No products found. Try another category, price range, or search.
            </div>
          )}
        </main>

        {selectedProduct && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={closeModal}>
                ✕
              </button>

              <div className="modal-content">
                <div className="modal-image-panel">
                  <img
                    src={`http://localhost:5000/uploads/products/${selectedProduct.image}`}
                    alt={selectedProduct.name}
                    className="modal-image"
                    onError={(e) => {
                      e.currentTarget.src = "https://via.placeholder.com/800x550?text=No+Image";
                    }}
                  />
                </div>

                <div className="modal-details">
                  <div className="modal-badges">
                    <span className="badge">{(selectedProduct.category || "unknown").toUpperCase()}</span>
                  </div>

                  <h2 className="modal-title">{selectedProduct.name}</h2>
                  <p className="modal-price">${Number(selectedProduct.price).toFixed(2)}</p>

                  <div className="modal-desc-wrap">
                    <p className="modal-desc">{selectedProduct.description || "No description provided."}</p>
                  </div>

                  <div className="modal-actions">
                    <button className="add-btn big" onClick={() => addToCart(selectedProduct)}>
                      Add to Cart
                    </button>
                    <button className="secondary-btn" onClick={closeModal}>
                      Close
                    </button>
                  </div>

                  <p className="modal-note">Click outside the modal or press Close to return.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
