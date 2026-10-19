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
import { localDateTimeToUtc, zonedDateTimeParts } from "@/src/utils/TimeUtils";
import { useDeleteBlockedTime } from "@/src/api/blocked-time/useDeleteBlockedTime";

const HOUR_MS = 60 * 60 * 1000;

function shiftHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * HOUR_MS).toISOString();
}

// Defaults are wall-clock times in the provider's timezone: a prefilled calendar day starts at
// `prefillHour`, otherwise the block starts `hoursFromNow` top-of-hours from now.
function getDefaultTime(prefillDate: string | null | undefined, prefillHour: number, hoursFromNow: number): string {
  if (prefillDate) {
    return localDateTimeToUtc(prefillDate, `${String(prefillHour).padStart(2, "0")}:00:00`);
  }
  const { dateStr, hour } = zonedDateTimeParts(new Date());
  return shiftHours(localDateTimeToUtc(dateStr, `${String(hour).padStart(2, "0")}:00:00`), hoursFromNow);
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
    startTimeUtc: blockedTime?.startTimeUtc ?? getDefaultTime(prefillDate, 9, 1),
    endTimeUtc: blockedTime?.endTimeUtc ?? getDefaultTime(prefillDate, 10, 2),
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
              testId="blocked-time-start-input"
              onChange={(v) =>
                setForm((f) => {
                  if (new Date(v) >= new Date(f.endTimeUtc)) {
                    return { ...f, startTimeUtc: v, endTimeUtc: shiftHours(v, 1) };
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
              testId="blocked-time-end-input"
              onChange={(v) =>
                setForm((f) => {
                  if (new Date(v) <= new Date(f.startTimeUtc)) {
                    return { ...f, endTimeUtc: v, startTimeUtc: shiftHours(v, -1) };
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
              data-testid="blocked-time-description-input"
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
