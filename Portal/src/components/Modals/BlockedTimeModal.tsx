"use client";

import { useState } from "react";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import { ACTION_ICONS } from "@/src/config/icons";
import { useCreateBlockedTime } from "@/src/api/blocked-time/useCreateBlockedTime";
import { useUpdateBlockedTime } from "@/src/api/blocked-time/useUpdateBlockedTime";
import { BlockedTime, BlockedTimeForm } from "@/src/types/BlockedTime";

function toLocalISOString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function getDefaultStartTime(prefillDate?: string | null): string {
  if (prefillDate) {
    const d = new Date(`${prefillDate}T09:00:00`);
    return toLocalISOString(d);
  }
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return toLocalISOString(now);
}

function getDefaultEndTime(prefillDate?: string | null): string {
  if (prefillDate) {
    const d = new Date(`${prefillDate}T10:00:00`);
    return toLocalISOString(d);
  }
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 2);
  return toLocalISOString(now);
}

export function BlockedTimeModal({
  blockedTime,
  prefillDate,
  onClose,
  onSaved,
}: {
  blockedTime?: BlockedTime;
  prefillDate?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!blockedTime;
  const { ref: trapRef, handleKeyDown: trapKeyDown } =
    useFocusTrap<HTMLDivElement>(onClose);
  const { createBlockedTime, loading: creating } = useCreateBlockedTime();
  const { updateBlockedTime, loading: updating } = useUpdateBlockedTime();

  const [form, setForm] = useState<BlockedTimeForm>({
    description: blockedTime?.description || "",
    startTimeUtc: blockedTime
      ? toLocalISOString(new Date(blockedTime.startTimeUtc))
      : getDefaultStartTime(prefillDate),
    endTimeUtc: blockedTime
      ? toLocalISOString(new Date(blockedTime.endTimeUtc))
      : getDefaultEndTime(prefillDate),
  });

  const [error, setError] = useState<string | null>(null);
  const loading = creating || updating;

  function updateField<K extends keyof BlockedTimeForm>(key: K, value: BlockedTimeForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.startTimeUtc || !form.endTimeUtc) {
      setError("Debe ingresar fecha y hora de inicio y fin");
      return;
    }

    const start = new Date(form.startTimeUtc);
    const end = new Date(form.endTimeUtc);

    if (end <= start) {
      setError("La fecha de fin debe ser posterior a la fecha de inicio");
      return;
    }

    try {
      const payload = {
        description: form.description || null,
        startTimeUtc: start.toISOString(),
        endTimeUtc: end.toISOString(),
      };

      if (isEdit && blockedTime) {
        await updateBlockedTime(blockedTime.id, payload);
      } else {
        await createBlockedTime(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      ref={trapRef}
      onKeyDown={trapKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Editar horario bloqueado" : "Bloquear horario"}
    >
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? "Editar Horario Bloqueado" : "Bloquear Horario"}
          </h2>
          <button className="btn-close" onClick={onClose}>
            <ACTION_ICONS.close size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "0 24px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="blocked-description"
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--c-gray-700)",
                marginBottom: 4,
              }}
            >
              Descripción (opcional)
            </label>
            <input
              id="blocked-description"
              type="text"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Ej: Almuerzo, Reunión, etc."
              maxLength={255}
              className="form-input"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="blocked-start"
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--c-gray-700)",
                marginBottom: 4,
              }}
            >
              Fecha y hora de inicio
            </label>
            <input
              id="blocked-start"
              type="datetime-local"
              value={form.startTimeUtc}
              onChange={(e) => updateField("startTimeUtc", e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="blocked-end"
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--c-gray-700)",
                marginBottom: 4,
              }}
            >
              Fecha y hora de fin
            </label>
            <input
              id="blocked-end"
              type="datetime-local"
              value={form.endTimeUtc}
              onChange={(e) => updateField("endTimeUtc", e.target.value)}
              required
              className="form-input"
            />
          </div>
          {error && (
            <div
              className="error-inline"
              style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}
            >
              <ACTION_ICONS.cancel size={14} /> {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary btn-block"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary btn-hero btn-block"
              disabled={loading}
            >
              {loading ? "Guardando…" : isEdit ? "Guardar Cambios" : "Bloquear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
