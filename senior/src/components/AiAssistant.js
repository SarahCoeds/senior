// src/components/AiAssistant.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../style/AiAssistant.css";
import { useChatStore } from "../context/ChatStore";
import { useNotify } from "./NotificationProvider";
import ConfirmModal from "./ConfirmModal";
import { useCart } from "../context/CartContext";

const CHAT_ENDPOINT = "http://127.0.0.1:8000/chat";
const PRODUCTS_ENDPOINT = "http://localhost:5000/api/products";

const norm = (s) => String(s || "").trim().toLowerCase();
const compact = (s) => norm(s).replace(/[^a-z0-9]/g, "");

function bestMatchProduct(allProducts, queryName) {
  const qn = norm(queryName);
  const qc = compact(queryName);
  if (!qn) return null;

  // 1) exact name match
  let exact = allProducts.find((p) => norm(p.name) === qn);
  if (exact) return exact;

  // 2) compact contains match
  let best = null;
  let bestScore = -1;

  for (const p of allProducts) {
    const pn = norm(p.name);
    const pc = compact(p.name);

    let score = 0;
    if (pn.includes(qn) || qn.includes(pn)) score += 5;
    if (pc.includes(qc) || qc.includes(pc)) score += 7;

    // token overlap
    const qTokens = new Set(qn.split(/\s+/).filter(Boolean));
    const pTokens = new Set(pn.split(/\s+/).filter(Boolean));
    let overlap = 0;
    qTokens.forEach((t) => pTokens.has(t) && overlap++);
    score += overlap;

    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  // require minimum confidence
  if (bestScore >= 6) return best;
  return null;
}

export default function AiAssistant() {
  const notify = useNotify();
  const { addToCart } = useCart();

  const {
    conversations,
    activeId,
    activeConversation,
    setActiveId,
    addMessage,
    newConversation,
    clearActiveConversation,
    deleteConversation,
    formatTime,
    makeId,
    nowISO,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", onConfirm: null });

  const [allProducts, setAllProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const messagesEndRef = useRef(null);
  const messages = activeConversation?.messages || [];

  const sidebarItems = useMemo(() => {
    return conversations
      .slice()
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 30);
  }, [conversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isTyping]);

  // Load products once for matching (so we can add-to-cart from assistant)
  useEffect(() => {
    let mounted = true;
    fetch(PRODUCTS_ENDPOINT)
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        setAllProducts(Array.isArray(data) ? data : []);
        setProductsLoaded(true);
      })
      .catch(() => {
        setProductsLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSend() {
    const text = String(input || "").trim();
    if (!text || isTyping) return;

    const userMessage = {
      id: makeId(),
      text,
      sender: "user",
      time: formatTime(),
      createdAt: nowISO(),
    };

    addMessage(userMessage);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: activeId || "" }),
      });

      const data = await res.json();

      const aiMessage = {
        id: makeId(),
        text: data?.response ?? "I didn't receive a response from the server.",
        sender: "ai",
        time: formatTime(),
        createdAt: nowISO(),
        payload: data || null, // store structured payload
      };

      addMessage(aiMessage);
    } catch (error) {
      console.error("Error getting AI response:", error);
      addMessage({
        id: makeId(),
        text: "Connection issue. Please ensure the AI backend server is running and try again.",
        sender: "ai",
        time: formatTime(),
        createdAt: nowISO(),
      });
      notify.error("AI server connection issue.");
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function askClear() {
    setConfirm({
      open: true,
      title: "Clear current chat",
      message: "This will clear the current conversation messages. The conversation will remain in your history.",
      onConfirm: () => {
        clearActiveConversation();
        notify.info("Chat cleared.");
        setConfirm((p) => ({ ...p, open: false }));
      },
    });
  }

  function askDeleteConversation(id) {
    setConfirm({
      open: true,
      title: "Delete conversation",
      message: "This will permanently remove the selected conversation from history.",
      onConfirm: () => {
        deleteConversation(id);
        notify.info("Conversation deleted.");
        setConfirm((p) => ({ ...p, open: false }));
      },
    });
  }

  const addAllBuildToCart = (items) => {
    if (!productsLoaded) {
      notify.error("Products are still loading. Try again in a second.");
      return;
    }
    if (!Array.isArray(items) || items.length === 0) return;

    let added = 0;
    let missing = 0;

        for (const it of items) {
          if (it?.owned) continue; // skip already-owned parts

          const match = bestMatchProduct(allProducts, it.product_match_query || it.name);
          if (match) {
            addToCart(match);
            added++;
          } else {
            missing++;
          }
        }


    if (added > 0) notify.info(`Added ${added} item(s) to cart.`);
    if (missing > 0) notify.error(`${missing} item(s) were not found in your Products DB (name mismatch).`);
  };

  const addSingleToCart = (item) => {
    if (!productsLoaded) {
      notify.error("Products are still loading. Try again in a second.");
      return;
    }
    const match = bestMatchProduct(allProducts, item.product_match_query || item.name);
    if (!match) {
      notify.error("This item was not found in your Products DB (name mismatch).");
      return;
    }
    addToCart(match);
    notify.info("Added to cart.");
  };

  const viewInProducts = (item) => {
    // Best effort: navigate to products with search query + open modal if match found
    const match = bestMatchProduct(allProducts, item.product_match_query || item.name);
    const q = encodeURIComponent(item.product_match_query || item.name || "");
    if (match?.id != null) {
      window.location.href = `/products?q=${q}&open=${encodeURIComponent(match.id)}`;
    } else {
      window.location.href = `/products?q=${q}`;
    }
  };

  return (
    <div className="ai-page">
      <div className="ai-shell">
        {/* Left: History */}
        <aside className="ai-sidebar">
          <div className="ai-brand">
            <div className="ai-brand-title">PC Assistant</div>
            <div className="ai-brand-sub">Ollama • Llama 3.1 8B</div>
          </div>

          <button className="ai-newchat" onClick={() => newConversation({ makeActive: true })}>
            New chat
          </button>

          <div className="ai-history">
            <div className="ai-history-label">History</div>

            {sidebarItems.map((c) => (
              <div
                key={c.id}
                className={`ai-history-item ${c.id === activeId ? "active" : ""}`}
                onClick={() => setActiveId(c.id)}
                role="button"
                tabIndex={0}
              >
                <div className="ai-history-title">{c.title || "Conversation"}</div>
                <div className="ai-history-meta">
                  {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                </div>

                <button
                  className="ai-history-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    askDeleteConversation(c.id);
                  }}
                  aria-label="Delete conversation"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="ai-sidebar-footer">
            <button className="ai-ghost" onClick={askClear} disabled={!activeConversation}>
              Clear chat
            </button>
          </div>
        </aside>

        {/* Right: Chat */}
        <section className="ai-chat">
          <header className="ai-header">
            <div className="ai-header-left">
              <div className="ai-title">AI Assistant</div>
              <div className="ai-subtitle">Build guidance, requirements, and part selection.</div>
            </div>

            <div className="ai-header-right">
              <div className="ai-status" title="Assistant is online">
                <span className="ai-status-dot" />
                Online
              </div>
            </div>
          </header>

          <div className="ai-messages">
            {messages.map((message) => {
              const isAi = message.sender === "ai";
              const buildItems = message?.payload?.build?.items;

              return (
                <div key={message.id} className={`ai-msg ${message.sender}`}>
                  <div className="ai-avatar">{message.sender === "user" ? "YOU" : "AI"}</div>

                  <div className="ai-bubble">
                    <div className="ai-text">{message.text}</div>

                    {/* Build actions */}
                    {isAi && Array.isArray(buildItems) && buildItems.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="add-btn" onClick={() => addAllBuildToCart(buildItems)}>
                            Add All to Cart
                          </button>
                        </div>

                        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                          {buildItems.map((it) => (
                            <div
                              key={`${it.category}-${it.csv_id}-${it.name}`}
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                justifyContent: "space-between",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 10,
                                padding: "8px 10px",
                              }}
                            >
                              <div style={{ fontSize: 13 }}>
                                <b>{it.category}:</b> {it.name}
                              </div>

                              <div style={{ display: "flex", gap: 8 }}>
                                <button className="secondary-btn" onClick={() => viewInProducts(it)}>
                                  View
                                </button>
                                <button className="add-btn" onClick={() => addSingleToCart(it)}>
                                  Add
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
                          Tip: If an item can't be added, it means its name doesn't match your Products DB yet.
                        </div>
                      </div>
                    )}

                    <div className="ai-time">{message.time}</div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="ai-msg ai">
                <div className="ai-avatar">AI</div>
                <div className="ai-bubble typing">
                  <div className="ai-typing-row">
                    <div className="ai-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="ai-typing-label">Analyzing your requirements...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <footer className="ai-inputbar">
            <div className="ai-inputwrap">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your PC building needs..."
                rows={2}
              />
            </div>

            <button className="ai-send" onClick={handleSend} disabled={isTyping || !String(input).trim()}>
              {isTyping ? "Processing..." : "Send"}
            </button>
          </footer>
        </section>
      </div>

      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmText="Confirm"
        cancelText="Cancel"
        tone="danger"
        onCancel={() => setConfirm((p) => ({ ...p, open: false }))}
        onConfirm={() => confirm.onConfirm?.()}
      />
    </div>
  );
}
