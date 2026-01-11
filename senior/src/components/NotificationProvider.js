import React, { createContext, useContext, useMemo, useState } from "react";
import Notification from "./Notification";
import "../style/NotificationStack.css";


const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);

  function remove(id) {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  function push({ message, type = "info" }) {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setItems((prev) => [...prev, { id, message, type }]);
    return id;
  }

  const api = useMemo(
    () => ({
      notify: push,
      success: (m) => push({ message: m, type: "success" }),
      error: (m) => push({ message: m, type: "error" }),
      warning: (m) => push({ message: m, type: "warning" }),
      info: (m) => push({ message: m, type: "info" }),
    }),
    []
  );

  return (
    <NotificationContext.Provider value={api}>
      {children}

      <div className="notif-stack">
        {items.map((n) => (
          <Notification key={n.id} message={n.message} type={n.type} onClose={() => remove(n.id)} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotify must be used within NotificationProvider");
  return ctx;
}
