import { useCreateAppointment } from "@/src/api/useCreateAppointment";
import { useCreateReminder } from "@/src/api/useCreateReminder";
import { useUpdateAppointment } from "@/src/api/useUpdateAppointment";
import { useUpdateReminder } from "@/src/api/useUpdateReminder";
import { Appointment, AppointmentForm, AppointmentStatus, APPT_TYPE_CFG, AppointmentDuration, APPOINTMENT_LOCATIONS, APT_LOCATION_CFG, APPT_STATUS_CFG, AppointmentType } from "@/src/types/Appointment";
import { ReminderType, Reminder, ReminderMode, ReminderStatus, CHANNEL_ICON, CHANNEL_LABEL, Channel, REMINDER_TYPE_CONFIG } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { isReminderTypeFeasible, formatDate, formatTime, getDuration, getRemindersendAt, getAppointmentEndTime, getTommorrowSixAm, getReminderType } from "@/src/utils/TimeUtils";
import { useState } from "react";
import { AppointmentDateTimePicker } from "../AppointmentDateTimePicker";
import { RequiredField } from "../Info/Requiered";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import { Patient } from "@/src/types/Patient";

export function AppointmentModal({ appt, prefillDate, onClose, onSaved }: {
  appt?: Appointment;
  prefillDate?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!appt;
  const { patients } = useFetchPatients();
  const { createAppointment } = useCreateAppointment();
  const { updateAppointment } = useUpdateAppointment();
  const { createReminder } = useCreateReminder();
  const { updateReminder } = useUpdateReminder();
  const [ step, setStep ] = useState(1);
  const [ saving, setSaving ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  const [ reminderChannel, setReminderChannel ] = useState<Channel>(Channel.WHATSAPP);

  const [ form, setForm ] = useState<AppointmentForm>({
    patientId: appt?.patient.id ?? "",
    startAt: appt?.startAt ?? prefillDate ?? getTommorrowSixAm(),
    status: appt?.status ?? AppointmentStatus.SCHEDULED,
    type: appt?.type ?? "",
    location: appt?.location ?? "",
    meetingUrl: appt?.meetingUrl ?? undefined,
    price: appt?.price ?? APPT_TYPE_CFG[AppointmentType.INDIVIDUAL].price,
    paid: appt?.paid ?? false,
    duration: getDuration(appt?.startAt, appt?.endAt) ?? APPT_TYPE_CFG[AppointmentType.INDIVIDUAL].duration,
    reminderType: appt?.reminder ? getReminderType(appt.startAt, appt.reminder.sendAt) : ReminderType.NONE,
    notes: appt?.notes ?? undefined,
  });


  const set = (field: keyof AppointmentForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [ field ]: e.target.value }));

  const selectedPatient = patients.find(p => p.id === form.patientId);

  const selectedChannelAvailable = reminderChannel === Channel.WHATSAPP ? !!selectedPatient?.whatsappNumber
    : reminderChannel === Channel.SMS ? !!selectedPatient?.smsNumber
      : !!selectedPatient?.email;

  const isValid = step === 1
    ? !!form.patientId && !!form.type && !!form.startAt
    : step === 2
      ? !!form.location && (form.reminderType !== ReminderType.NONE ? selectedChannelAvailable : true)
      : !!form.price;

  function buildReminderPayload(): Partial<Reminder> {
    const to = reminderChannel === Channel.WHATSAPP
      ? selectedPatient?.whatsappNumber || ""
      : reminderChannel === Channel.SMS
        ? selectedPatient?.smsNumber || ""
        : selectedPatient?.email || "";

    return {
      to,
      contentSid: "HXb5b62575e6e4ff6129ad7c8efe1f983e",
      contentVariables: {
        "1": "12/1",
        "2": "3pm"
      },
      patientId: form.patientId,
      channel: reminderChannel,
      sendMode: ReminderMode.SCHEDULED,
      status: ReminderStatus.PENDING,
      sendAt: getRemindersendAt(form.startAt, form.reminderType),
    };
  }

  function buildAppointmentPayload(): Partial<Appointment> {
    return {
      ...form,
      endAt: getAppointmentEndTime(form.startAt, form.duration as AppointmentDuration),
    }
  }

  async function handleSubmit() {
    setSaving(true); setError(null);
    try {
      if (isEdit) {
        if (appt!.reminder) {
          if (form.reminderType === ReminderType.NONE) {
            await updateReminder(appt!.reminder.id, { status: ReminderStatus.CANCELLED });
          } else {
            await updateReminder(appt!.reminder.id, buildReminderPayload());
          }
        } else if (form.reminderType !== ReminderType.NONE) {
          const reminder = await createReminder(buildReminderPayload())
          form.reminderId = reminder.id;
        }

        await updateAppointment(appt!.id, buildAppointmentPayload());
      } else {
        if (form.reminderType !== ReminderType.NONE) {
          const reminder = await createReminder(buildReminderPayload())
          form.reminderId = reminder.id;
        }

        await createAppointment(buildAppointmentPayload());
      }
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally { setSaving(false); }
  }

  const steps = [ "Paciente & Tipo", "Lugar & Hora", "Pago & Estado" ];

  return (
    <div className="modal-overlay modal-overlay--nested" onClick={onClose}>
      <div className="modal-panel modal-panel--lg slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header modal-header--top">
          <div>
            <h2 className="modal-title">
              {isEdit ? "Editar Cita" : "Nueva Cita"}
            </h2>
            <p className="modal-subtitle">{steps[ step - 1 ]} — Paso {step} de {steps.length}</p>
          </div>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>
        <div className="step-bar">
          {steps.map((_, i) => (
            <div key={i} className={`step-bar__segment ${i < step ? "step-bar__segment--done" : ""}`} />
          ))}
        </div>
        {error && (
          <div className="error-inline">⚠️ {error}</div>
        )}
        {step === 1 && <PatientAndTypeStep form={form} setForm={setForm} patients={patients} isEdit={isEdit} selectedPatient={selectedPatient} />}
        {step === 2 && <LocationAndTimeStep form={form} set={set} selectedPatient={selectedPatient} reminderChannel={reminderChannel} setReminderChannel={setReminderChannel} />}
        {step === 3 && <PaymentAndStatusStep form={form} set={set} selectedPatient={selectedPatient} />}
        <div className="modal-footer">
          {step > 1 && <button onClick={() => setStep(s => s - 1)} className="btn-secondary" disabled={saving}>Atrás</button>}
          {step < steps.length
            ? <button onClick={() => { setError(null); setStep(s => s + 1); }} disabled={!isValid} className="btn-primary">Continuar →</button>
            : <button onClick={handleSubmit} disabled={saving || !isValid} className="btn-primary">
              {saving ? "Guardando…" : isEdit ? "Guardar Cambios" : "✓ Crear Cita"}
            </button>
          }
        </div>
      </div>
    </div>
  );
}


type SetField = (field: keyof AppointmentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;

function PatientAndTypeStep({ form, setForm, patients, isEdit, selectedPatient }: { form: AppointmentForm; setForm: React.Dispatch<React.SetStateAction<AppointmentForm>>; patients: Patient[]; isEdit: boolean; selectedPatient: Patient | undefined }) {
  return (<div className="form-stack">
    {!isEdit && <label className="form-label">
      <RequiredField label="Paciente" />
      <select className="form-input" value={form.patientId} onChange={(e) => setForm(f => ({ ...f, patientId: e.target.value }))}>
        <option value="">Seleccionar paciente…</option>
        {patients.filter(p => p.status === "ACTIVE").map(p => (
          <option key={p.id} value={p.id}>{p.name} {p.lastName}</option>
        ))}
      </select>
    </label>}

    {selectedPatient && (
      <div className="patient-preview">
        <div className="patient-preview__avatar" style={{ background: getAvatarColor(selectedPatient.id) }}>
          {getInitials(selectedPatient.name, selectedPatient.lastName)}
        </div>
        <div>
          <div className="patient-preview__name">{selectedPatient.name} {selectedPatient.lastName}</div>
          <div className="patient-preview__detail">{selectedPatient.email}</div>
        </div>
      </div>
    )}
    <label className="form-label">
      <RequiredField label="Fecha y Hora" />
      <AppointmentDateTimePicker date={form.startAt} onChanged={(date) => setForm(f => ({ ...f, startAt: date }))} />
    </label>
    <label className="form-label">
      <RequiredField label="Tipo de cita" />
      <select className="form-input" value={form.type} onChange={(e) => {
        setForm(f => ({ ...f, type: e.target.value, price: APPT_TYPE_CFG[e.target.value as AppointmentType]?.price ?? APPT_TYPE_CFG[AppointmentType.INDIVIDUAL].price, duration: APPT_TYPE_CFG[e.target.value as AppointmentType]?.duration ?? APPT_TYPE_CFG[AppointmentType.INDIVIDUAL].duration }))
      }}>
        <option value="">Seleccionar tipo…</option>
        {(Object.keys(APPT_TYPE_CFG) as AppointmentType[]).map(t => <option key={t} value={t}>{APPT_TYPE_CFG[t].label}</option>)}
      </select>
    </label>
  </div>)
}

function LocationAndTimeStep({ form, set, selectedPatient, reminderChannel, setReminderChannel }: { form: AppointmentForm; set: SetField; selectedPatient: Patient | undefined; reminderChannel: Channel; setReminderChannel: (c: Channel) => void }) {
  return (
    <div className="form-stack">
      <label className="form-label">
        <RequiredField label="Duración" />
        <select className="form-input" value={form.duration} onChange={set("duration")}>
          {Object.values(AppointmentDuration).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>

      <label className="form-label">
        <RequiredField label="Ubicación" />
        <select className="form-input" value={form.location} onChange={set("location")}>
          <option value="">Seleccionar ubicación…</option>
          {APPOINTMENT_LOCATIONS.map(d => <option key={d} value={d}>{APT_LOCATION_CFG[ d ]?.label || d}</option>)}
        </select>
      </label>

      {form.location === "Virtual" && (
        <label className="form-label">
          URL de videollamada
          <input type="url" className="form-input" value={form.meetingUrl} onChange={set("meetingUrl")} placeholder="https://meet.example.com/sala" />
        </label>
      )}
      {selectedPatient?.whatsappNumber || selectedPatient?.email || selectedPatient?.smsNumber ?
        <div>
          <label className="form-label">
            Recordatorio
            <select className="form-input" value={form.reminderType} onChange={set("reminderType")}>
              <option value={ReminderType.NONE}>Sin recordatorio</option>
              <option value={ReminderType.ONE_HOUR_BEFORE} disabled={!isReminderTypeFeasible(form.startAt, ReminderType.ONE_HOUR_BEFORE)}>1 hora antes</option>
              <option value={ReminderType.ONE_DAY_BEFORE} disabled={!isReminderTypeFeasible(form.startAt, ReminderType.ONE_DAY_BEFORE)}>1 día antes</option>
              <option value={ReminderType.ONE_WEEK_BEFORE} disabled={!isReminderTypeFeasible(form.startAt, ReminderType.ONE_WEEK_BEFORE)}>1 semana antes</option>
            </select>
          </label>
          {form.reminderType !== ReminderType.NONE && (
            <div>
              <div className="channel-section-label">Canal de notificación</div>
              <div style={{ display: "flex", gap: 10 }}>
                {Object.values(Channel).map(c => {
                  const available = (c === Channel.WHATSAPP && !!selectedPatient?.whatsappNumber) || (c === Channel.SMS && !!selectedPatient?.smsNumber) || (c === Channel.EMAIL && !!selectedPatient?.email);
                  return (
                    <button
                      key={c}
                      onClick={() => available && setReminderChannel(c)}
                      className={`selection-card${reminderChannel === c ? " selection-card--active" : ""}${!available ? " selection-card--disabled" : ""}`}
                      style={{ flex: 1 }}
                    >
                      <span style={{ fontSize: 22 }}>{CHANNEL_ICON[ c ]}</span>
                      <div style={{ textAlign: "left" }}>
                        <div className="patient-preview__name">{CHANNEL_LABEL[ c ]}</div>
                        <div className="patient-preview__detail">
                          {available
                            ? (c === Channel.WHATSAPP ? selectedPatient?.whatsappNumber : c === Channel.SMS ? selectedPatient?.smsNumber : selectedPatient?.email)
                            : "No disponible"}
                        </div>
                      </div>
                      {reminderChannel === c && available && <span style={{ marginLeft: "auto", color: "var(--c-brand)" }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        : <div>
          <label className="form-label">Recordatorio</label>
          <div className="error-inline">
            ⚠️ El paciente no tiene forma de contacto registrada, por lo que no se podrán enviar recordatorios automáticos.
          </div>
        </div>
      }
    </div>
  );
}

function PaymentAndStatusStep({ form, set, selectedPatient }: { form: AppointmentForm; set: SetField; selectedPatient: Patient | undefined }) {
  return (
    <div className="form-stack">
      <div className="form-grid-2">
        <label className="form-label">
          <RequiredField label="Precio" />
          <div className="input-prefix">
            <span className="input-prefix__symbol">$</span>
            <input type="number" step="0.01" className="form-input" value={form.price} onChange={set("price")} placeholder="150.00" />
          </div>
        </label>
        <label className="form-label">
          Estado
          <select className="form-input" value={form.status} onChange={set("status")}>
            {(Object.keys(APPT_STATUS_CFG) as AppointmentStatus[]).map(s => (
              <option key={s} value={s}>{APPT_STATUS_CFG[ s ].icon} {APPT_STATUS_CFG[ s ].label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="summary-card">
        <div className="summary-card__label">Resumen</div>
        {[
          [ "Paciente", selectedPatient ? `${selectedPatient.name} ${selectedPatient.lastName}` : "—" ],
          [ "Tipo", form.type || "—" ],
          [ "Fecha", `${formatDate(form.startAt)} a las ${formatTime(form.startAt)}` ],
          [ "Duración", form.duration ],
          [ "Ubicación", form.location || "—" ],
          [ "Precio", `$${form.price}` ],
          [ "Recordatorio", form.reminderType !== ReminderType.NONE ? REMINDER_TYPE_CONFIG[ form.reminderType ].label : "Sin recordatorio" ],
        ].map(([ k, v ]) => (
          <div key={k} className="summary-row">
            <span className="summary-row__key">{k}</span>
            <span className="summary-row__value">{v}</span>
          </div>
        ))}
      </div>
      <div>
        <label className="form-label">
          Notas
          <input className="form-input" onChange={set("notes")}></input>
        </label>
      </div>
    </div>
  );
}
