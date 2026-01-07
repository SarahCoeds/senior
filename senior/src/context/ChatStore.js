// src/context/ChatStore.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "pcbuild_chat_v1";

function nowISO() {
  return new Date().toISOString();
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function defaultWelcomeMessage() {
  return {
    id: makeId(),
    text:
      "Hello, I'm Bear your PC Building Assistant. I specialize in helping you create custom computer builds tailored to your specific needs—whether for gaming, content creation, programming, or professional work.\n\nWhat will you be primarily using your new PC for?",
    sender: "ai",
    time: formatTime(),
    createdAt: nowISO(),
  };
}

function makeConversation() {
  const id = makeId();
  const createdAt = nowISO();
  return {
    id,
    title: "New conversation",
    createdAt,
    updatedAt: createdAt,
    messages: [defaultWelcomeMessage()],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const ChatStoreContext = createContext(null);

export function ChatStoreProvider({ children }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // Load once
  useEffect(() => {
    const loaded = loadState();
    if (loaded?.conversations?.length) {
      setConversations(loaded.conversations);
      setActiveId(loaded.activeId || loaded.conversations[0]?.id || null);
      return;
    }

    // First run: create an initial conversation
    const convo = makeConversation();
    setConversations([convo]);
    setActiveId(convo.id);
  }, []);

  // Persist
  useEffect(() => {
    if (!activeId) return;
    saveState({ conversations, activeId });
  }, [conversations, activeId]);

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeId) || null;
  }, [conversations, activeId]);

  function setTitleFromFirstUserMessage(convo) {
    const firstUser = convo.messages.find((m) => m.sender === "user");
    if (!firstUser) return convo.title;
    const t = String(firstUser.text || "").trim().slice(0, 48);
    return t ? t : convo.title;
  }

  function updateConversation(id, updater) {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = updater(c);
        return {
          ...next,
          updatedAt: nowISO(),
          title: setTitleFromFirstUserMessage(next),
        };
      })
    );
  }

  function addMessage(message) {
    if (!activeId) return;
    updateConversation(activeId, (c) => ({
      ...c,
      messages: [...c.messages, message],
    }));
  }

  function newConversation({ makeActive = true } = {}) {
    const convo = makeConversation();
    setConversations((prev) => [convo, ...prev]);
    if (makeActive) setActiveId(convo.id);
    return convo.id;
  }

  function clearActiveConversation() {
    if (!activeId) return;
    updateConversation(activeId, (c) => ({
      ...c,
      messages: [defaultWelcomeMessage()],
      title: "New conversation",
    }));
  }

  function deleteConversation(id) {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      // Ensure at least one conversation exists
      if (next.length === 0) {
        const convo = makeConversation();
        setActiveId(convo.id);
        return [convo];
      }
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  }

  // On refresh: start a new chat, but keep the last one saved in history
  // This matches what you described ("on refresh start new conversation, last saved").
  // Call this once from App root if you want this behavior always.
  function startNewChatOnRefresh() {
    newConversation({ makeActive: true });
  }

  const value = {
    conversations,
    activeId,
    activeConversation,
    setActiveId,
    addMessage,
    newConversation,
    clearActiveConversation,
    deleteConversation,
    startNewChatOnRefresh,
    formatTime,
    makeId,
    nowISO,
  };

  return <ChatStoreContext.Provider value={value}>{children}</ChatStoreContext.Provider>;
}

export function useChatStore() {
  const ctx = useContext(ChatStoreContext);
  if (!ctx) throw new Error("useChatStore must be used within ChatStoreProvider");
  return ctx;
}
