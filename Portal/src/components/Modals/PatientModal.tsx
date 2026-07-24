import { useCreatePatient } from "@/src/api/patients/useCreatePatient";
import { useUpdatePatient } from "@/src/api/patients/useUpdatePatient";
import {
  Patient,
  PatientStatus,
  PATIENT_STATUS_CONFIG,
} from "@/src/types/Patient";
import { validateEmail, validatePhoneNumber } from "@/src/utils/dataValidator";
import { useState } from "react";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import { RequiredField } from "../Info/Required";
import { CountryCodeInput } from "../CountryCodeInput";
import { CustomSelect } from "../CustomSelect";
import {
  LBL_CANCEL,
  LBL_CREATE_PATIENT,
  LBL_SAVE_CHANGES,
  LBL_SAVING,
} from "@/src/constants/ui";
import { Channel, CHANNEL_CFG, ReminderMode } from "@/src/types/Reminder";
import { useNotify } from "@/src/api/notify/useNotify";
import { TWILIO_CONFIG } from "@/src/utils/twilioConfig";
import { useAuthContext } from "@/src/providers/AuthContext";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { useFetchAppointmentTypes } from "@/src/api/appointment-types/useFetchAppointmentTypes";

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
  const { notify } = useNotify();
  const { user } = useAuthContext();
  const { createPatient } = useCreatePatient();
  const { updatePatient } = useUpdatePatient();
  const { appointmentTypes } = useFetchAppointmentTypes();
  const { ref: trapRef, handleKeyDown: trapKeyDown } =
    useFocusTrap<HTMLDivElement>(onClose);
  const [ saving, setSaving ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  const [ sendWelcomeMessage, setSendWelcomeMessage ] = useState(false);

  const [ form, setForm ] = useState({
    name: patient?.name ?? "",
    lastName: patient?.lastName ?? "",
    email: patient?.email,
    whatsappNumber: patient?.whatsappNumber,
    smsNumber: patient?.smsNumber,
    dateOfBirth: patient?.dateOfBirth,
    notes: patient?.notes,
    status: patient?.status ?? ("ACTIVE" as PatientStatus),
    appointmentTypeId: patient?.appointmentTypeId,
  });
  const isValid = !!form.name && !!form.lastName;
  const canSendWelcome =
    !!user?.displayName &&
    !!user?.bankName &&
    !!user?.accountNumber &&
    !!user?.nationalId &&
    !!user?.bankingKey &&
    !!user.consentDocument;

  const set =
    (field: keyof typeof form) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [ field ]: e.target.value }));

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
      setError(
        "Por favor, ingresa un número de WhatsApp válido (formato E.164).",
      );
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
        const patient = await createPatient(form);
        if (sendWelcomeMessage && patient) {
          if (user && canSendWelcome) {
            notify(user.reminderChannel, {
              patientId: patient.id,
              to: user.reminderChannel === Channel.WHATSAPP
                ? patient.whatsappNumber!
                : patient.smsNumber!,
              sendMode: ReminderMode.IMMEDIATE,
              sendAt: new Date().toISOString(),
              body: TWILIO_CONFIG.PATIENT_WELCOME_MESSAGE.template
                .replace("{{1}}", patient.name)
                .replace("{{2}}", user.displayName)
                .replace("{{3}}", user.bankName!)
                .replace("{{4}}", user.accountNumber!)
                .replace("{{5}}", `${user.firstName} ${user.lastName}`)
                .replace("{{6}}", user.nationalId!)
                .replace("{{7}}", user.bankingKey!),
              contentSid: TWILIO_CONFIG.PATIENT_WELCOME_MESSAGE.contentSid,
              contentVariables: {
                "1": patient.name,
                "2": user.displayName,
                "3": user.bankName!,
                "4": user.accountNumber!,
                "5": `${user.firstName} ${user.lastName}`,
                "6": user.nationalId!,
                "7": user.bankingKey!,
                "8": user.id,
              },
            });
          }
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Editar Paciente" : "Nuevo Paciente"}
      ref={trapRef}
      onKeyDown={trapKeyDown}
    >
      <div
        className="modal-panel modal-panel--md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {isEdit ? "Editar Paciente" : "Nuevo Paciente"}
            </h2>
            <p className="modal-subtitle">
              {isEdit
                ? `Modificando: ${patient!.name} ${patient!.lastName}`
                : "Registrar un nuevo paciente en el sistema"}
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
        <div className="form-stack">
          <div className="form-grid-2">
            <label className="form-label">
              <RequiredField label="Nombre" />
              <input
                className="form-input"
                value={form.name}
                onChange={set("name")}
                placeholder="ej. María"
              />
            </label>
            <label className="form-label">
              <RequiredField label="Apellido" />
              <input
                autoComplete="family-name"
                className="form-input"
                value={form.lastName}
                onChange={set("lastName")}
                placeholder="ej. García"
              />
            </label>
          </div>
          <label className="form-label">
            Correo electrónico
            <input
              className="form-input"
              type="email"
              value={form.email || undefined}
              onChange={set("email")}
              placeholder="paciente@ejemplo.com"
            />
          </label>
          <div className="form-grid-2">
            <label className="form-label">
              WhatsApp
              <CountryCodeInput
                value={form.whatsappNumber || undefined}
                onChange={(v) => setForm((f) => ({ ...f, whatsappNumber: v }))}
              />
            </label>
            <label className="form-label">
              SMS
              <CountryCodeInput
                value={form.smsNumber || undefined}
                onChange={(v) => setForm((f) => ({ ...f, smsNumber: v }))}
              />
            </label>
          </div>
          {!isEdit && canSendWelcome && (
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  paddingBottom: 4,
                  userSelect: "none",
                  cursor:
                    !form.whatsappNumber && !form.smsNumber
                      ? "not-allowed"
                      : "pointer",
                  opacity: !form.whatsappNumber && !form.smsNumber ? 0.5 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={sendWelcomeMessage}
                  onChange={(e) => setSendWelcomeMessage(e.target.checked)}
                  disabled={!form.whatsappNumber && !form.smsNumber}
                  style={{ width: 15, height: 15 }}
                />
                <span>Mandar mensaje de bienvenida por {CHANNEL_CFG[ user.reminderChannel ].label}</span>
              </label>
            </div>
          )}
          <label className="form-label">
            Tipo de citas
            <CustomSelect
              value={form.appointmentTypeId || ''}
              options={
                appointmentTypes.length > 0
                  ? appointmentTypes?.map((t) => ({
                    value: t.id,
                    label: t.name,
                  }))
                  : [ { value: "", label: "No hay tipos de cita registrados" } ]

              }
              onChange={(v) =>
                setForm((f) => ({ ...f, appointmentTypeId: v }))
              }
            />
          </label>
          <label className="form-label">
            Notas
            <textarea
              className="form-input form-input--textarea"
              value={form.notes || undefined}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Notas adicionales sobre el paciente..."
            />
          </label>
          {isEdit && (
            <label className="form-label">
              Estado
              <CustomSelect
                value={form.status}
                options={Object.values(PatientStatus).map((s) => ({
                  value: s,
                  label: PATIENT_STATUS_CONFIG[ s ].label,
                }))}
                onChange={(v) =>
                  setForm((f) => ({ ...f, status: v as PatientStatus }))
                }
              />
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            {LBL_CANCEL}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !isValid}
            className="btn-primary"
          >
            {saving
              ? LBL_SAVING
              : isEdit
                ? LBL_SAVE_CHANGES
                : LBL_CREATE_PATIENT}
          </button>
        </div>
      </div>
    </div>
  );
}
