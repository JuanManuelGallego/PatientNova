import { useState } from "react";
import { Appointment, APPOINTMENT_LOCATIONS, APPOINTMENT_TYPES, AppointmentDuration, AppointmentForm, AppointmentStatus, LOCATION_CFG, STATUS_CFG } from "../types/Appointment";
import { Patient } from "../types/Patient";
import { Channel, CHANNEL_ICON, CHANNEL_LABEL, Reminder, ReminderMode, ReminderStatus, ReminderType } from "../types/Reminder";
import { btnDisabled, btnPrimary, btnSecondary, inp, lbl } from "../styles/theme";
import { getAvatarColor, getInitials } from "../utils/AvatarHelper";
import { useCreateAppointment } from "../api/useCreateAppointment";
import { useUpdateAppointment } from "../api/useUpdateAppointment";
import { useCreateReminder } from "../api/useCreateReminder";
import { useUpdateReminder } from "../api/useUpdateReminder";
import { getDate, getRemindersentAt as getReminderscheduledSendTime, getTime, isReminderTypeFeasible } from "../utils/TimeUtils";
import { DateTimePicker } from "./DateTimePicker";

export function AppointmentModal({ appt, patients, onClose, onSaved }: {
  appt?: Appointment;
  patients: Patient[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!appt;
  const { createAppointment } = useCreateAppointment();
  const { updateAppointment } = useUpdateAppointment();
  const { createReminder } = useCreateReminder();
  const { updateReminder } = useUpdateReminder();
  const [ step, setStep ] = useState(1);
  const [ saving, setSaving ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  const [ reminderChannel, setReminderChannel ] = useState<Channel>(Channel.WHATSAPP);

  const [ form, setForm ] = useState<AppointmentForm>({
    patientId: appt?.patientId ?? "",
    date: appt?.date ?? "",
    status: appt?.status ?? AppointmentStatus.SCHEDULED,
    type: appt?.type ?? APPOINTMENT_TYPES[ 1 ].name,
    location: appt?.location ?? "",
    meetingUrl: appt?.meetingUrl ?? undefined,
    price: appt?.price ?? APPOINTMENT_TYPES[ 1 ].price,
    payed: appt?.payed ?? false,
    duration: appt?.duration ?? APPOINTMENT_TYPES[ 1 ].duration,
    reminderType: appt?.reminderId ? ReminderType.ONE_DAY_BEFORE : ReminderType.NONE,
    notes: appt?.notes ?? undefined,
  });

  const isValid = step === 1
    ? !!form.patientId && !!form.type && !!form.date
    : step === 2
      ? !!form.location && (form.reminderType !== ReminderType.NONE ? reminderChannel : true)
      : !!form.price;

  const set = (field: keyof AppointmentForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [ field ]: e.target.value }));

  const selectedPatient = patients.find(p => p.id === form.patientId);

  function buildReminderPayload(): Partial<Reminder> {
    return {
      to: reminderChannel === Channel.WHATSAPP ? selectedPatient?.whatsappNumber || "" : selectedPatient?.smsNumber || "",
      contentSid: "HXb5b62575e6e4ff6129ad7c8efe1f983e",
      contentVariables: {
        "1": "12/1",
        "2": "3pm"
      },
      patientId: form.patientId,
      channel: reminderChannel,
      sendMode: ReminderMode.SCHEDULED,
      status: ReminderStatus.PENDING,
      sendAt: new Date(getReminderscheduledSendTime(form.date, form.reminderType)).toISOString(), //sendAt instead
    };
  }

  async function handleSubmit() {
    setSaving(true); setError(null);
    try {
      if (isEdit) {
        if (appt!.reminderId) {
          await updateReminder(appt!.reminderId, buildReminderPayload()); // Remove new sendAt???
        } else if (form.reminderType !== ReminderType.NONE) {
          const reminder = await createReminder(buildReminderPayload())
          form.reminderId = reminder.id;
        }

        await updateAppointment(appt!.id, form);
      } else {
        if (form.reminderType !== ReminderType.NONE) {
          const reminder = await createReminder(buildReminderPayload())
          form.reminderId = reminder.id;
        }

        await createAppointment(form);
      }
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally { setSaving(false); }
  }

  const steps = [ "Paciente & Tipo", "Lugar & Hora", "Pago & Estado" ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 36, width: 580, maxWidth: "calc(100vw - 40px)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)", animation: "slideUp 0.2s ease" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
              {isEdit ? "Editar Cita" : "Nueva Cita"}
            </h2>
            <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>{steps[ step - 1 ]} — Paso {step} de {steps.length}</p>
          </div>
          <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 5, marginBottom: 28 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? "#1E3A5F" : "#E5E7EB", transition: "background 0.3s" }} />
          ))}
        </div>
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#DC2626" }}>⚠️ {error}</div>
        )}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!isEdit && <label style={lbl}>
              Paciente
              <select style={inp} value={form.patientId} onChange={set("patientId")}>
                <option value="">Seleccionar paciente…</option>
                {patients.filter(p => p.status === "ACTIVE").map(p => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </select>
            </label>}

            {selectedPatient && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8F7F4", borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: getAvatarColor(selectedPatient.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1E3A5F" }}>
                  {getInitials(selectedPatient.name, selectedPatient.lastName)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{selectedPatient.name} {selectedPatient.lastName}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selectedPatient.email}</div>
                </div>
              </div>
            )}
            <DateTimePicker date={form.date} onChanged={(date) => setForm(f => ({ ...f, date: date }))} />
            <label style={lbl}>
              Tipo de cita
              <select style={inp} value={form.type} onChange={(e) => {
                setForm(f => ({ ...f, type: e.target.value, price: APPOINTMENT_TYPES.find(t => t.name === e.target.value)?.price ?? "", duration: APPOINTMENT_TYPES.find(t => t.name === e.target.value)?.duration ?? "" }))
              }}>
                <option value="">Seleccionar tipo…</option>
                {APPOINTMENT_TYPES.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </label>

          </div>
        )}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={lbl}>
              Duración
              <select style={inp} value={form.duration} onChange={set("duration")}>
                {Object.values(AppointmentDuration).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>

            <label style={lbl}>
              Ubicación
              <select style={inp} value={form.location} onChange={set("location")}>
                <option value="">Seleccionar ubicación…</option>
                {APPOINTMENT_LOCATIONS.map(d => <option key={d} value={d}>{LOCATION_CFG[ d ]?.label || d}</option>)}
              </select>
            </label>

            {form.location === "Virtual" && (
              <label style={lbl}>
                URL de videollamada <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(opcional)</span>
                <input type="url" style={inp} value={form.meetingUrl} onChange={set("meetingUrl")} placeholder="https://meet.example.com/sala" />
              </label>
            )}
            <label style={lbl}>
              Recordatorio <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(opcional)</span>
              <select style={inp} value={form.reminderType} onChange={set("reminderType")}>
                <option value={ReminderType.NONE}>Sin recordatorio</option>
                <option value={ReminderType.ONE_HOUR_BEFORE} disabled={!isReminderTypeFeasible(form.date, ReminderType.ONE_HOUR_BEFORE)}>1 hora antes</option>
                <option value={ReminderType.ONE_DAY_BEFORE} disabled={!isReminderTypeFeasible(form.date, ReminderType.ONE_DAY_BEFORE)}>1 día antes</option>
                <option value={ReminderType.ONE_WEEK_BEFORE} disabled={!isReminderTypeFeasible(form.date, ReminderType.ONE_WEEK_BEFORE)}>1 semana antes</option>
              </select>
            </label>
            {form.reminderType !== ReminderType.NONE && (<div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Canal de notificación</div>
              <div style={{ display: "flex", gap: 10 }}>
                {Object.values(Channel).map(c => {
                  const available = (c === Channel.WHATSAPP && !!selectedPatient?.whatsappNumber) || (c === Channel.SMS && !!selectedPatient?.smsNumber);
                  return (
                    <button key={c} onClick={() => available && setReminderChannel(c)} style={{
                      flex: 1, display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 16px", borderRadius: 12,
                      border: `2px solid ${reminderChannel === c ? "#1E3A5F" : "#E5E7EB"}`,
                      background: !available ? "#F9FAFB" : reminderChannel === c ? "#EFF6FF" : "#fff",
                      cursor: available ? "pointer" : "not-allowed",
                      opacity: available ? 1 : 0.5,
                    }}>
                      <span style={{ fontSize: 22 }}>{CHANNEL_ICON[ c ]}</span>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{CHANNEL_LABEL[ c ]}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                          {available
                            ? (c === Channel.WHATSAPP ? selectedPatient?.whatsappNumber : selectedPatient?.smsNumber)
                            : "No disponible"}
                        </div>
                      </div>
                      {reminderChannel === c && available && <span style={{ marginLeft: "auto", color: "#1E3A5F" }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        )}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={lbl}>
                Precio
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#6B7280", fontSize: 14 }}>$</span>
                  <input type="number" step="0.01" style={{ ...inp, paddingLeft: 28 }} value={form.price} onChange={set("price")} placeholder="150.00" />
                </div>
              </label>
              <label style={lbl}>
                Estado
                <select style={inp} value={form.status} onChange={set("status")}>
                  {(Object.keys(STATUS_CFG) as AppointmentStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CFG[ s ].icon} {STATUS_CFG[ s ].label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Payment toggle */}
            {/* <div style={{ background: "#F8F7F4", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Estado de pago</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>¿El paciente ya realizó el pago?</div>
                </div>
                <button onClick={() => setForm(f => ({ ...f, payed: !f.payed }))} style={{
                  width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                  background: form.payed ? "#16A34A" : "#D1D5DB",
                  position: "relative", transition: "background 0.2s",
                }}>
                  <span style={{
                    position: "absolute", top: 3, left: form.payed ? 26 : 3,
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>
              {form.payed && <div style={{ marginTop: 10, fontSize: 13, color: "#16A34A", fontWeight: 500 }}>✓ Marcado como pagado</div>}
            </div> */}
            <div style={{ background: "#F8F7F4", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Resumen</div>
              {[
                [ "Paciente", selectedPatient ? selectedPatient.fullName : "—" ],
                [ "Tipo", form.type || "—" ],
                [ "Fecha", `${getDate(form.date)} a las ${getTime(form.date)}` ],
                [ "Duración", form.duration ],
                [ "Ubicación", form.location || "—" ],
                [ "Precio", `$${form.price}` ],
                [ "Recordatorio", form.reminderType !== ReminderType.NONE ? form.reminderType!.replaceAll("_", " ").toLowerCase() : "Sin recordatorio" ],
              ].map(([ k, v ]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#6B7280" }}>{k}</span>
                  <span style={{ color: "#111827", fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            <div>
              <label style={lbl}>
                Notas
                <input style={inp} onChange={set("notes")}></input>
              </label>
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 28 }}>
          {step > 1 && <button onClick={() => setStep(s => s - 1)} style={btnSecondary} disabled={saving}>Atrás</button>}
          {step < steps.length
            ? <button onClick={() => { setError(null); setStep(s => s + 1); }} disabled={!isValid} style={isValid ? btnPrimary : btnDisabled}>Continuar →</button>
            : <button onClick={handleSubmit} disabled={saving || !isValid} style={{ ...(isValid ? btnPrimary : btnDisabled), opacity: saving || !isValid ? 0.7 : 1 }}>
              {saving ? "Guardando…" : isEdit ? "Guardar Cambios" : "✓ Crear Cita"}
            </button>
          }
        </div>
      </div>
    </div>
  );
}