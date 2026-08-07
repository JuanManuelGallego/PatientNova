"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { useCreateBlockedTime } from "@/src/api/blocked-time/useCreateBlockedTime";
import { useUpdateBlockedTime } from "@/src/api/blocked-time/useUpdateBlockedTime";
import { BlockedTime, BlockedTimeForm } from "@/src/types/BlockedTime";
import {
  LBL_CANCEL,
  LBL_SAVING,
  LBL_SAVE,
  ERR_SAVE,
} from "@/src/constants/ui";
import { RequiredField } from "../Info/Required";
import { DateTimePicker } from "../DateTimePicker";
import { useDeleteBlockedTime } from "@/src/api/blocked-time";

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
  const { createBlockedTime } = useCreateBlockedTime();
  const { updateBlockedTime } = useUpdateBlockedTime();
  const { deleteBlockedTime } = useDeleteBlockedTime();

  const firstInputRef = useRef<HTMLInputElement>(null);
  const [ saving, setSaving ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);

  const [ form, setForm ] = useState<BlockedTimeForm>({
    description: blockedTime?.description || "",
    startTimeUtc: blockedTime
      ? toLocalISOString(new Date(blockedTime.startTimeUtc))
      : getDefaultStartTime(prefillDate),
    endTimeUtc: blockedTime
      ? toLocalISOString(new Date(blockedTime.endTimeUtc))
      : getDefaultEndTime(prefillDate),
  });

  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, []);

  const setField =
    (field: keyof BlockedTimeForm) =>
      (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [ field ]: e.target.value }));

  function validate(): boolean {
    if (!form.startTimeUtc || !form.endTimeUtc) return false;
    const start = new Date(form.startTimeUtc);
    const end = new Date(form.endTimeUtc);
    return end > start;
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    if (!form.startTimeUtc || !form.endTimeUtc) {
      setError("Debe ingresar fecha y hora de inicio y fin");
      setSaving(false);
      return;
    }

    const start = new Date(form.startTimeUtc);
    const end = new Date(form.endTimeUtc);

    if (end <= start) {
      setError("La fecha de fin debe ser posterior a la fecha de inicio");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        description: form.description.trim() || null,
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
      setError(err instanceof Error ? err.message : ERR_SAVE);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      if (isEdit && blockedTime) {
        await deleteBlockedTime(blockedTime.id);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
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
      data-testid="blocked-time-modal-dialog"
    >
      <div
        className="modal-panel modal-panel--sm slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {isEdit ? "Editar Horario Bloqueado" : "Bloquear Horario"}
            </h2>
            <p className="modal-subtitle">
              {isEdit
                ? `Modificando: ${blockedTime.description || "Horario bloqueado"}`
                : "Selecciona las fechas y horas que deseas bloquear"}
            </p>
          </div>
          <button onClick={onClose} className="btn-close" data-testid="blocked-time-modal-close-button">
            <ACTION_ICONS.close size={16} />
          </button>
        </div>

        {error && (
          <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <STATUS_ICONS.warning size={14} /> {error}
          </div>
        )}

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="form-label">
            <RequiredField label={"Fecha y hora de inicio"} />
            <DateTimePicker
              isFuture
              showTime
              date={form.startTimeUtc}
              onChanged={(v) =>
                setForm((f) => {
                  const newStart = new Date(v);
                  const currentEnd = new Date(f.endTimeUtc);
                  if (newStart >= currentEnd) {
                    newStart.setHours(newStart.getHours() + 1);
                    return { ...f, startTimeUtc: v, endTimeUtc: toLocalISOString(newStart) };
                  }
                  return { ...f, startTimeUtc: v };
                })
              }
            />
          </label>
          <label className="form-label">
            <RequiredField label={"Fecha y hora de fin"} />
            <DateTimePicker
              isFuture
              showTime
              date={form.endTimeUtc}
              onChanged={(v) =>
                setForm((f) => {
                  const newEnd = new Date(v);
                  const currentStart = new Date(f.startTimeUtc);
                  if (newEnd <= currentStart) {
                    newEnd.setHours(newEnd.getHours() - 1);
                    return { ...f, endTimeUtc: v, startTimeUtc: toLocalISOString(newEnd) };
                  }
                  return { ...f, endTimeUtc: v };
                })
              }
            />
          </label>
          <label className="form-label">
            Descripción
            <input
              ref={firstInputRef}
              className="form-input"
              type="text"
              value={form.description}
              onChange={setField("description")}
              placeholder="Ej: Almuerzo, Reunión, etc."
              maxLength={255}
            />
          </label>

          <div className="modal-footer">
            {isEdit && (
              <button
                onClick={handleDelete}
                className="btn-action-delete"
                disabled={saving}
                data-testid="blocked-time-modal-delete-button"
              >
                <ACTION_ICONS.delete size={14} />
              </button>)
            }
            <button
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
              data-testid="blocked-time-modal-cancel-button"
            >
              {LBL_CANCEL}
            </button>
            <button
              onClick={handleSubmit}
              className="btn-primary"
              disabled={saving || !validate()}
              data-testid="blocked-time-modal-submit-button"
            >
              {saving ? LBL_SAVING : isEdit ? LBL_SAVE : "Bloquear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
