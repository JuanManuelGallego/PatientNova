import { Patient } from "@/src/types/Patient";
import {
  ReminderMode,
  Channel,
  ReminderForm,
  CHANNEL_CFG,
} from "@/src/types/Reminder";
import { Appointment } from "@/src/types/Appointment";
import { fmtDateTime, fmtDate } from "@/src/utils/TimeUtils";
import { TwilioTemplate } from "@/src/utils/twilioConfig";

export function SummaryStep({
  form,
  selectedPatient,
  sendMode,
  channel,
  selectedTemplate,
  preview,
  selectedAppointment,
}: {
  form: ReminderForm;
  selectedPatient: Patient | undefined;
  sendMode: ReminderMode;
  channel: Channel | undefined;
  selectedTemplate: TwilioTemplate;
  preview: string;
  selectedAppointment: Appointment | null | undefined;
}) {
  const resolvedTo =
    channel === Channel.WHATSAPP
      ? (selectedPatient?.whatsappNumber ?? "—")
      : channel === Channel.SMS
        ? (selectedPatient?.smsNumber ?? "—")
        : (selectedPatient?.email ?? "—");

  return (
    <div className="form-stack">
      <div className="summary-card">
        <div className="summary-card__label">Resumen del recordatorio</div>
        {[
          {
            k: "Paciente",
            v: selectedPatient
              ? `${selectedPatient.name} ${selectedPatient.lastName}`
              : "—",
          },
          { k: "Canal", v: channel ? CHANNEL_CFG[ channel ].label : "—" },
          { k: "Plantilla", v: selectedTemplate.label },
          {
            k: "Cita asociada",
            v: selectedAppointment
              ? `${fmtDate(selectedAppointment.startAt)} — ${selectedAppointment.appointmentType?.name ?? "Cita"}`
              : "Ninguna",
          },
          {
            k: "Enviará a",
            v: resolvedTo,
          },
          {
            k: "Programado",
            v:
              sendMode === ReminderMode.IMMEDIATE
                ? "Inmediatamente"
                : form.sendAt
                  ? fmtDateTime(form.sendAt)
                  : "—",
          },
        ].map(({ k, v }) => (
          <div key={k} className="summary-row">
            <span className="summary-row__key">{k}</span>
            <span className="summary-row__value">{v}</span>
          </div>
        ))}
        <div className="summary-card__divider">
          <div className="summary-card__sublabel">Mensaje</div>
          <div className="summary-card__body">{preview || form.message || "—"}</div>
        </div>
      </div>
    </div>
  );
}
