"use client";

import { useState } from "react";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { RequiredField } from "../Info/Required";
import { LBL_CANCEL, LBL_SAVING } from "@/src/constants/ui";
import { useCreatePatientType, useRenamePatientType } from "@/src/api/patient-types/usePatientTypeMutations";
import { PatientType } from "@/src/types/PatientType";

export function PatientTypeNameModal({
  patientType,
  onClose,
  onSaved,
}: {
  patientType: PatientType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!patientType;
  const { createPatientType, loading: creating } = useCreatePatientType();
  const { renamePatientType, loading: renaming } = useRenamePatientType();
  const { ref: trapRef, handleKeyDown: trapKeyDown } = useFocusTrap<HTMLDivElement>(onClose);
  const [ name, setName ] = useState(patientType?.name ?? "");
  const [ error, setError ] = useState<string | null>(null);
  const saving = creating || renaming;
  const title = isEdit ? "Renombrar tipo de paciente" : "Nuevo tipo de paciente";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Escribe un nombre.");
      return;
    }
    setError(null);
    try {
      if (isEdit) await renamePatientType(patientType.id, trimmed);
      else await createPatientType(trimmed);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar el tipo de paciente.");
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={trapRef}
      onKeyDown={trapKeyDown}
      data-testid="patient-type-modal"
    >
      <div className="modal-panel modal-panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" onClick={onClose} className="btn-close" aria-label="Cerrar">
            <ACTION_ICONS.close size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }} data-testid="patient-type-modal-error">
              <STATUS_ICONS.warning size={14} /> {error}
            </div>
          )}
          <div className="form-stack">
            <label className="form-label">
              <RequiredField label="Nombre" />
              <input
                className="form-input"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej. Familia, Nutrición, Pareja"
                data-autofocus
                data-testid="patient-type-name-input"
              />
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">{LBL_CANCEL}</button>
            <button type="submit" className="btn-primary" disabled={saving} data-testid="patient-type-save-button">
              {saving ? LBL_SAVING : isEdit ? "Guardar" : "Crear tipo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
