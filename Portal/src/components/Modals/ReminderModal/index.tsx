import { useCreateReminder } from "@/src/api/reminders/useCreateReminder";
import { useNotify } from "@/src/api/notify/useNotify";
import {
  Reminder,
  ReminderMode,
  Channel,
  ReminderForm,
} from "@/src/types/Reminder";
import { DEFAULT_APPT_STATUS, Appointment, AppointmentType } from "@/src/types/Appointment";
import { getUserName } from "@/src/utils/AvatarHelper";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { useState, useMemo } from "react";
import { useFetchPatients } from "@/src/api/patients/useFetchPatients";
import { useFetchPatient } from "@/src/api/patients/useFetchPatient";
import { useFetchAppointments } from "@/src/api/appointments/useFetchAppointments";
import { TWILIO_CONFIG } from "@/src/utils/twilioConfig";
import { useAuthContext } from "@/src/providers/AuthContext";
import { ERR_MSG_EMPTY } from "@/src/constants/ui";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import { validatePhoneNumber } from "@/src/utils/DataValidator";
import {
  computeAutoFilledVariables,
  buildPreview,
  selectTemplateForAppointment,
} from "./utils";
import { SetField } from "./types";
import { SendModeAndPatientStep } from "./SendModeAndPatientStep";
import { TemplateAndChannelStep } from "./TemplateAndChannelStep";
import { VariablesAndPreviewStep } from "./VariablesAndPreviewStep";
import { SummaryStep } from "./SummaryStep";

export function ReminderModal({
  onClose,
  onSaved,
  reminder,
}: {
  onClose: () => void;
  onSaved: () => void;
  reminder?: Reminder;
}) {
  const isEdit = !!reminder;
  const { user } = useAuthContext();
  const { ref: trapRef, handleKeyDown: trapKeyDown } =
    useFocusTrap<HTMLDivElement>(onClose);

  const { createReminder } = useCreateReminder();
  const { notify } = useNotify();
  const { patients } = useFetchPatients();

  const channel = user?.reminderChannel ?? Channel.WHATSAPP;
  const [ step, setStep ] = useState(1);
  const [ sendMode, setMode ] = useState<ReminderMode>(ReminderMode.IMMEDIATE);
  const [ saving, setSaving ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);

  const defaultTemplate = "PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_PRESENTIAL";

const [ form, setForm ] = useState<ReminderForm>({
    patientId: "",
    channel: channel ?? Channel.WHATSAPP,
    message: "",
    sendAt: "",
    selectedTemplate: defaultTemplate,
    contentVariables: {},
    appointmentId: "",
  });

  const selectedPatient = patients.find((p) => p.id === form.patientId);
  const { patient: fullPatient } = useFetchPatient(form.patientId);
  const selectedTemplate = TWILIO_CONFIG[form.selectedTemplate];

  const { appointments: patientAppointments } = useFetchAppointments(
    form.patientId
      ? { patientId: form.patientId, status: DEFAULT_APPT_STATUS }
      : undefined,
  );

  const selectedAppointment = form.appointmentId
    ? patientAppointments.find((a) => a.id === form.appointmentId)
    : null;

  const preview = useMemo(
    () => buildPreview(selectedTemplate, form.contentVariables),
    [ selectedTemplate, form.contentVariables ],
  );

  const channelAvailable =
    (channel === Channel.WHATSAPP && !!selectedPatient?.whatsappNumber) ||
    (channel === Channel.SMS && !!selectedPatient?.smsNumber);

  const isValid =
    step === 1
      ? !!form.patientId &&
      (sendMode === ReminderMode.SCHEDULED ? !!form.sendAt : true)
      : step === 2
        ? !!form.selectedTemplate && channelAvailable
        : step === 3
          ? channel === Channel.WHATSAPP
            ? selectedTemplate.variables.every(
              (v) => (form.contentVariables[v.key] || "").trim() !== "",
            )
            : !!form.message.trim()
          : true;

  const set: SetField = (field) => (e) =>
    setForm((f) => ({ ...f, [ field ]: e.target.value }));

  function computeAutoFill(
    templateKey: string,
    appointment?: Appointment | null,
    appointmentType?: AppointmentType | null,
  ) {
    const tmpl = TWILIO_CONFIG[templateKey];
    return computeAutoFilledVariables(
      tmpl,
      selectedPatient?.name ?? "",
      getUserName(user),
      appointment,
      user,
      appointmentType,
    );
  }

  function handlePatientChange(patientId: string) {
    const patient = patients.find((p) => p.id === patientId);
    const autoFilled = computeAutoFill(form.selectedTemplate, undefined, patient?.appointmentType);
    setForm((f) => ({
      ...f,
      patientId,
      appointmentId: "",
      contentVariables: autoFilled,
    }));
  }

  function handleTemplateChange(templateKey: string) {
    const autoFilled = computeAutoFill(
      templateKey,
      selectedAppointment,
      selectedAppointment?.appointmentType ?? fullPatient?.appointmentType,
    );
    setForm((f) => ({
      ...f,
      selectedTemplate: templateKey,
      contentVariables: autoFilled,
      message: "",
    }));
  }

  function handleAppointmentChange(appointmentId: string) {
    const appt = patientAppointments.find((a) => a.id === appointmentId);
    if (!appt) return;

    const newTemplateKey = selectTemplateForAppointment(appt);
    const autoFilled = computeAutoFill(
      newTemplateKey,
      appt,
      appt.appointmentType ?? fullPatient?.appointmentType,
    );
    setForm((f) => ({
      ...f,
      appointmentId,
      selectedTemplate: newTemplateKey,
      contentVariables: autoFilled,
    }));
  }

  function validateForm() {
    if (!channel) {
      setError(
        "No tienes un canal de recordatorio configurado. Ve a Configuración → Recordatorios para definirlo.",
      );
      return false;
    }
    if (!selectedPatient) {
      setError("Selecciona un paciente");
      return false;
    }
    if (channel === Channel.WHATSAPP) {
      if (!selectedPatient.whatsappNumber) {
        setError(
          "El paciente no tiene número de WhatsApp registrado. Agrega el número o cambia el canal en Configuración.",
        );
        return false;
      }
      if (!validatePhoneNumber(selectedPatient.whatsappNumber)) {
        setError("El número de WhatsApp del paciente no es válido");
        return false;
      }
      const missing = selectedTemplate.variables.filter(
        (v) => !(form.contentVariables[v.key] || "").trim(),
      );
      if (missing.length > 0) {
        setError(
          `Faltan campos: ${missing.map((v) => v.label).join(", ")}`,
        );
        return false;
      }
    }
    if (channel === Channel.SMS) {
      if (!form.message.trim()) {
        setError(ERR_MSG_EMPTY);
        return false;
      }
      if (!selectedPatient.smsNumber) {
        setError(
          "El paciente no tiene número de SMS registrado. Agrega el número o cambia el canal en Configuración.",
        );
        return false;
      }
      if (!validatePhoneNumber(selectedPatient.smsNumber)) {
        setError("El número de SMS del paciente no es válido");
        return false;
      }
    }
    if (sendMode === ReminderMode.SCHEDULED && !form.sendAt) {
      setError("Selecciona fecha y hora de envío");
      return false;
    }
    setError(null);
    return true;
  }

  function resolveTo(): string {
    if (!selectedPatient || !channel) return "";
    if (channel === Channel.WHATSAPP)
      return selectedPatient.whatsappNumber ?? "";
    if (channel === Channel.SMS) return selectedPatient.smsNumber ?? "";
    return selectedPatient.email ?? "";
  }

  function buildPayload() {
    return {
      to: resolveTo(),
      ...(channel === Channel.WHATSAPP && {
        contentSid: selectedTemplate.contentSid,
        contentVariables: form.contentVariables,
      }),
      ...(channel === Channel.SMS && {
        body: preview,
      }),
      patientId: form.patientId,
      ...(form.appointmentId && { appointmentId: form.appointmentId }),
    };
  }

  function buildScheduledPayload() {
    return {
      ...buildPayload(),
      channel: channel!,
      sendMode: sendMode,
      sendAt: new Date(form.sendAt).toISOString(),
    };
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    setSaving(true);
    setError(null);
    try {
      if (sendMode === ReminderMode.IMMEDIATE) {
        await notify(channel!, buildPayload());
      } else {
        await createReminder(buildScheduledPayload());
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  const totalSteps = 4;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Editar Recordatorio" : "Nuevo Recordatorio"}
      ref={trapRef}
      onKeyDown={trapKeyDown}
    >
      <div
        className="modal-panel modal-panel--md slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header modal-header--top">
          <div>
            <h2 className="modal-title">
              {isEdit ? "Editar Recordatorio" : "Nuevo Recordatorio"}
            </h2>
            <p className="modal-subtitle">
              Paso {step} de {totalSteps}
            </p>
          </div>
          <button onClick={onClose} className="btn-close">
            <ACTION_ICONS.close size={16} />
          </button>
        </div>
        <div className="step-bar">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`step-bar__segment ${i < step ? "step-bar__segment--done" : ""}`}
            />
          ))}
        </div>
        {error && (
          <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <STATUS_ICONS.warning size={14} /> {error}
          </div>
        )}
        {step === 1 && (
          <SendModeAndPatientStep
            sendMode={sendMode}
            setMode={setMode}
            form={form}
            setForm={setForm}
            patients={patients}
            patientAppointments={patientAppointments}
            onPatientChange={handlePatientChange}
            onAppointmentChange={handleAppointmentChange}
          />
        )}
        {step === 2 && (
          <TemplateAndChannelStep
            form={form}
            selectedPatient={selectedPatient}
            channel={channel}
            onTemplateChange={handleTemplateChange}
          />
        )}
        {step === 3 && (
          <VariablesAndPreviewStep
            form={form}
            setForm={setForm}
            set={set}
            channel={channel}
            selectedTemplate={selectedTemplate}
            preview={preview}
          />
        )}
        {step === 4 && (
          <SummaryStep
            form={form}
            selectedPatient={selectedPatient}
            sendMode={sendMode}
            channel={channel}
            selectedTemplate={selectedTemplate}
            preview={preview}
            selectedAppointment={selectedAppointment}
          />
        )}
        <div className="modal-footer">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="btn-secondary"
              disabled={saving}
            >
              Atrás
            </button>
          )}
          {step < totalSteps ? (
            <button
              onClick={() => {
                setError(null);
                setStep((s) => s + 1);
              }}
              disabled={!isValid}
              className="btn-primary"
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary"
            >
              {saving
                ? "Enviando…"
                : sendMode === ReminderMode.IMMEDIATE
                  ? "Enviar ahora"
                  : "Programar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
