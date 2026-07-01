"use client";

import { useEffect, useRef, useState } from "react";
import { useCreateLocation } from "@/src/api/useCreateLocation";
import { useUpdateLocation } from "@/src/api/useUpdateLocation";
import {
  AppointmentLocation,
  AppointmentLocationForm,
} from "@/src/types/Appointment";
import { RequiredField } from "@/src/components/Info/Required";
import {
  LBL_CANCEL,
  LBL_CREATE_LOCATION,
  LBL_SAVE,
  LBL_SAVING,
  ERR_SAVE,
} from "@/src/constants/ui";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";

export function LocationModal({
  onClose,
  onSaved,
  location,
}: {
  onClose: () => void;
  onSaved: () => void;
  location?: AppointmentLocation | null;
}) {
  const isEdit = !!location;
  const { createLocation } = useCreateLocation();
  const { updateLocation } = useUpdateLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<AppointmentLocationForm>({
    name: location?.name ?? "",
    address: location?.address ?? "",
    color: location?.color ?? "#2563EB",
    isVirtual: location?.isVirtual ?? false,
    instructions: location?.instructions ?? "",
  });

  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, []);

  const setField =
    (field: keyof AppointmentLocationForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = {
        name: form.name.trim(),
        address: form.isVirtual ? null : form.address.trim() || null,
        color: form.color,
        isVirtual: form.isVirtual,
        instructions: form.isVirtual ? null : form.instructions.trim() || null,
      };
      if (isEdit) {
        await updateLocation(location!.id, data);
      } else {
        await createLocation(data);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : ERR_SAVE);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel modal-panel--sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {isEdit ? "Editar ubicación" : "Nueva ubicación"}
            </h2>
            <p className="modal-subtitle">
              {isEdit
                ? `Modificando: ${location!.name}`
                : "Configura un nuevo lugar de atención"}
            </p>
          </div>
          <button onClick={onClose} className="btn-close">
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
            <RequiredField label="Nombre" />
            <input
              ref={firstInputRef}
              className="form-input"
              value={form.name}
              onChange={setField("name")}
              placeholder="Consultorio Centro"
              required
            />
          </label>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <label className="form-label" style={{ flex: "0 0 auto" }}>
              Color en el calendario
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  className="form-input"
                  type="color"
                  value={form.color}
                  onChange={setField("color")}
                  style={{
                    width: 52,
                    height: 36,
                    padding: 3,
                    cursor: "pointer",
                  }}
                />
              </div>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                cursor: "pointer",
                paddingBottom: 4,
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={form.isVirtual}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    isVirtual: e.target.checked,
                    address: e.target.checked ? "" : f.address,
                  }))
                }
                style={{ width: 15, height: 15 }}
              />
              <span>
                Es ubicación virtual
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "var(--c-gray-400)",
                    lineHeight: 1.3,
                  }}
                >
                  Videollamada / remoto
                </span>
              </span>
            </label>
          </div>
          {!form.isVirtual && (
            <>
              <label className="form-label">
                <RequiredField label="Dirección" />
                <input
                  className="form-input"
                  value={form.address}
                  onChange={setField("address")}
                  placeholder="Calle 50 #30-20"
                  disabled={form.isVirtual}
                />
              </label>
              <label className="form-label">
                <RequiredField label="Instrucciones para los pacientes" />
                <input
                  className="form-input"
                  value={form.instructions}
                  onChange={setField("instructions")}
                  placeholder="Preguntar en recepcion por el local 5"
                  disabled={form.isVirtual}
                />
              </label>
            </>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              {LBL_CANCEL}
            </button>
            <button
              type="submit"
              className="btn-primary btn-hero"
              disabled={
                saving ||
                !form.name.trim() ||
                (!form.isVirtual && !form.address.trim()) ||
                (!form.isVirtual && !form.instructions.trim())
              }
            >
              {saving ? LBL_SAVING : isEdit ? LBL_SAVE : LBL_CREATE_LOCATION}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
