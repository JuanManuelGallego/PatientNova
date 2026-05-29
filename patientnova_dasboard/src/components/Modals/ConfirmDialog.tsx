"use client";

import React from "react";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import { type LucideIcon, STATUS_ICONS } from "@/src/config/icons";

interface ConfirmDialogProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  loadingLabel?: string;
  loading?: boolean;
  error?: string | null;
  nested?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  icon: Icon,
  title,
  children,
  cancelLabel = "Regresar",
  confirmLabel,
  loadingLabel,
  loading = false,
  error = null,
  nested = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const { ref: trapRef, handleKeyDown: trapKeyDown } =
    useFocusTrap<HTMLDivElement>(onClose);
  const WarnIcon = STATUS_ICONS.warning;
  return (
    <div
      className={`modal-overlay${nested ? " modal-overlay--nested" : ""}`}
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      ref={trapRef}
      onKeyDown={trapKeyDown}
    >
      <div
        className="modal-panel modal-panel--sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-confirm">
          <div className="modal-confirm__icon modal-confirm__icon-wrap">
            <Icon size={44} style={{ color: "var(--c-gray-400)" }} />
          </div>
          <h2 className="modal-title modal-title--sm">{title}</h2>
          {children}
        </div>
        {error && (
          <div className="error-inline error-inline--flex">
            <WarnIcon size={14} /> {error}
          </div>
        )}
        <div className="modal-confirm__actions">
          <button
            onClick={onClose}
            className="btn-secondary btn-block"
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn-danger btn-block"
          >
            {loading ? (loadingLabel ?? `${confirmLabel}…`) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
