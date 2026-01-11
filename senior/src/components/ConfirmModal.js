
import React from "react";
import "../style/ConfirmModal.css";


export default function ConfirmModal({
  open,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "danger", 
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="cm-overlay" onClick={onCancel}>
      <div className="cm-card" onClick={(e) => e.stopPropagation()}>
        <div className="cm-header">
          <div className="cm-title">{title}</div>
          <button className="cm-x" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="cm-body">{message}</div>

        <div className="cm-actions">
          <button className="cm-btn cm-btn-ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`cm-btn ${tone === "danger" ? "cm-btn-danger" : "cm-btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
