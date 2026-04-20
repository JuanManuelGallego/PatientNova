import { useCreatePatient } from "@/src/api/useCreatePatient";
import { useUpdatePatient } from "@/src/api/useUpdatePatient";
import { Patient, PatientStatus, PATIENT_STATUS_CONFIG } from "@/src/types/Patient";
import { validateEmail, validatePhoneNumber } from "@/src/utils/DataValidator";
import { useState } from "react";
import { RequiredField } from "../Info/Required";
import { DateTimePicker } from "../DateTimePicker";
import { CountryCodeInput } from "../CountryCodeInput";
import { CustomSelect } from "../CustomSelect";
import { LBL_CANCEL, LBL_CREATE_PATIENT, LBL_SAVE_CHANGES, LBL_SAVING, ERR_SAVE } from "@/src/constants/ui";

export function PatientModal({
  onClose,
  onSaved,
  patient,
}: {
  onClose: () => void;
  onSaved: () => void;
  patient?: Patient;
}) {
  const isEdit = !!patient;
  const { createPatient } = useCreatePatient();
  const { updatePatient } = useUpdatePatient();
  const [ saving, setSaving ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  const [ form, setForm ] = useState({
    name: patient?.name ?? "",
    lastName: patient?.lastName ?? "",
    email: patient?.email,
    whatsappNumber: patient?.whatsappNumber,
    smsNumber: patient?.smsNumber,
    dateOfBirth: patient?.dateOfBirth,
    notes: patient?.notes,
    status: patient?.status ?? "ACTIVE" as PatientStatus,
  });
  const isValid = !!form.name && !!form.lastName;

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [ field ]: e.target.value }));

  function validateForm() {
    if (!form.name || !form.lastName) {
      setError("Por favor, completa todos los campos requeridos.");
      return false;
    }
    if (form.email && !validateEmail(form.email)) {
      setError("Por favor, ingresa un correo electrónico válido.");
      return false;
    }
    if (form.whatsappNumber && !validatePhoneNumber(form.whatsappNumber)) {
      setError("Por favor, ingresa un número de WhatsApp válido (formato E.164).");
      return false;
    }
    if (form.smsNumber && !validatePhoneNumber(form.smsNumber)) {
      setError("Por favor, ingresa un número de SMS válido (formato E.164).");
      return false;
    }
    setError(null);
    return true;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updatePatient(patient!.id, form);
      } else {
        await createPatient(form);
      }
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel--md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {isEdit ? "Editar Paciente" : "Nuevo Paciente"}
            </h2>
            <p className="modal-subtitle">
              {isEdit ? `Modificando: ${patient!.name} ${patient!.lastName}` : "Registrar un nuevo paciente en el sistema"}
            </p>
          </div>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>
        {error && (
          <div className="error-inline">⚠️ {error}</div>
        )}
        <div className="form-stack">
          <div className="form-grid-2">
            <label className="form-label">
              <RequiredField label="Nombre" />
              <input className="form-input" value={form.name} onChange={set("name")} placeholder="ej. María" />
            </label>
            <label className="form-label">
              <RequiredField label="Apellido" />
              <input autoComplete="family-name" className="form-input" value={form.lastName} onChange={set("lastName")} placeholder="ej. García" />
            </label>
          </div>
          {/* <label className="form-label">
            📅 Fecha de Nacimiento
            <DateTimePicker
              date={form.dateOfBirth || undefined}
              onChanged={(date) => setForm(f => ({ ...f, dateOfBirth: date }))}
            />
          </label> */}
          <label className="form-label">
            ✉️ Correo electrónico
            <input className="form-input" type="email" value={form.email || undefined} onChange={set("email")} placeholder="paciente@ejemplo.com" />
          </label>
          <div className="form-grid-2">
            <label className="form-label">
              💬 WhatsApp
              <CountryCodeInput
                value={form.whatsappNumber || undefined}
                onChange={(v) => setForm(f => ({ ...f, whatsappNumber: v }))}
              />
            </label>
            <label className="form-label">
              📱 SMS
              <CountryCodeInput
                value={form.smsNumber || undefined}
                onChange={(v) => setForm(f => ({ ...f, smsNumber: v }))}
              />
            </label>
          </div>
          <label className="form-label">
            📝 Notas
            <textarea className="form-input form-input--textarea" value={form.notes || undefined} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas adicionales sobre el paciente..." />
          </label>
          {isEdit && <label className="form-label">
            Estado
            <CustomSelect
              value={form.status}
              options={Object.values(PatientStatus).map(s => ({ value: s, label: `${PATIENT_STATUS_CONFIG[ s ].icon} ${PATIENT_STATUS_CONFIG[ s ].label}` }))}
              onChange={(v) => setForm(f => ({ ...f, status: v as PatientStatus }))}
            />
          </label>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>{LBL_CANCEL}</button>
          <button onClick={handleSubmit} disabled={saving || !isValid} className="btn-primary btn-hero">
            {saving ? LBL_SAVING : isEdit ? LBL_SAVE_CHANGES : LBL_CREATE_PATIENT}
          </button>
        </div>
      </div>
    </div>
  );
}
