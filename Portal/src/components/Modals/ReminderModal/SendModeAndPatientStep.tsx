import { Patient } from "@/src/types/Patient";
import { ReminderMode, ReminderForm } from "@/src/types/Reminder";
import { Appointment } from "@/src/types/Appointment";
import { ACTION_ICONS } from "@/src/config/icons";
import { fmtDate } from "@/src/utils/TimeUtils";
import { PatientAutocomplete } from "@/src/components/PatientAutocomplete";
import { CustomSelect } from "@/src/components/CustomSelect";
import { DateTimePicker } from "@/src/components/DateTimePicker";
import { RequiredField } from "@/src/components/Info/Required";

export function SendModeAndPatientStep({
  sendMode,
  setMode,
  form,
  setForm,
  patients,
  patientAppointments,
  onPatientChange,
  onAppointmentChange,
}: {
  sendMode: ReminderMode;
  setMode: (m: ReminderMode) => void;
  form: ReminderForm;
  setForm: React.Dispatch<React.SetStateAction<ReminderForm>>;
  patients: Patient[];
  patientAppointments: Appointment[];
  onPatientChange: (patientId: string) => void;
  onAppointmentChange: (appointmentId: string) => void;
}) {
  return (
    <div className="form-stack">
      <div>
        <div className="channel-section-label">
          <RequiredField label="Tipo de envío" />
        </div>
        <div className="form-grid-2">
          {(
            [
              {
                key: ReminderMode.IMMEDIATE,
                title: "Enviar ahora",
                sub: "Se envía inmediatamente",
              },
              {
                key: ReminderMode.SCHEDULED,
                title: "Programar envío",
                sub: "Elegir fecha y hora",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className={`selection-card selection-card--column${sendMode === opt.key ? " selection-card--active" : ""}`}
            >
              <span className="patient-preview__name">{opt.title}</span>
              <span className="patient-preview__detail">{opt.sub}</span>
              {sendMode === opt.key && (
                <span
                  style={{
                    marginLeft: "auto",
                    color: "var(--c-brand)",
                    fontSize: 16,
                    alignSelf: "flex-end",
                  }}
                >
                  <ACTION_ICONS.confirm size={16} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {sendMode === ReminderMode.SCHEDULED && (
        <label className="form-label">
          <RequiredField label="Fecha y hora de envío" />
          <DateTimePicker
            date={form.sendAt}
            onChanged={(d) => setForm((f) => ({ ...f, sendAt: d }))}
            showTime
            isFuture
            testId="reminder-send-at-picker"
          />
        </label>
      )}
      <label className="form-label">
        <RequiredField label="Paciente" />
        <PatientAutocomplete
          disabled={patients.length === 0}
          value={form.patientId}
          placeholder="Seleccionar paciente…"
          onChange={onPatientChange}
        />
      </label>
      {form.patientId && (
        <label className="form-label">
          Asociar a cita
          <CustomSelect
            disabled={!patientAppointments || patientAppointments.length === 0}
            value={form.appointmentId ?? ""}
            placeholder={
              patientAppointments && patientAppointments.length > 0
                ? "Sin cita asociada"
                : "No hay citas disponibles para este paciente"
            }
            options={
              patientAppointments && patientAppointments.length > 0
                ? [
                  { value: "", label: "Sin cita asociada" },
                  ...patientAppointments.map((a) => ({
                    value: a.id,
                    label: `${fmtDate(a.startAt)} — ${a.appointmentType?.name ?? "Cita"}`,
                  })),
                ]
                : [ { value: "", label: "No hay citas disponibles" } ]
            }
            onChange={onAppointmentChange}
          />
          <span className="form-input-hint">
            {patientAppointments && patientAppointments.length > 0
              ? "Selecciona una cita para auto-llenar fecha, hora y otros campos"
              : "El paciente no tiene citas programadas o confirmadas"}
          </span>
        </label>
      )}
    </div>
  );
}
