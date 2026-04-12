import { useCreateAppointment } from "@/src/api/useCreateAppointment";
import { useCreateReminder } from "@/src/api/useCreateReminder";
import { useUpdateAppointment } from "@/src/api/useUpdateAppointment";
import { useUpdateReminder } from "@/src/api/useUpdateReminder";
import { Appointment, AppointmentForm, AppointmentStatus, AppointmentDuration, APPT_STATUS_CFG, APPT_PAID_STATUS_CFG, AppointmentPaidStatus, REMINDER_TEMPLATE, AppointmentLocation, AppointmentType } from "@/src/types/Appointment";
import { ReminderType, Reminder, ReminderMode, ReminderStatus, CHANNEL_CFG, Channel, REMINDER_TYPE_CONFIG } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { isReminderTypeFeasible, formatDate, formatTime, getDuration, getRemindersendAt, getAppointmentEndTime, getTommorrowSixAm, getReminderType, getDate } from "@/src/utils/TimeUtils";
import { useState } from "react";
import { AppointmentDateTimePicker } from "../AppointmentDateTimePicker";
import { CustomSelect } from "../CustomSelect";
import { RequiredField } from "../Info/Requiered";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import { Patient } from "@/src/types/Patient";
import { useFetchAppointmentTypes } from "@/src/api/useFetchAppointmentTypes";
import { useFetchLocations } from "@/src/api/useFetchLocations";

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
  const { locations } = useFetchLocations();
  const { appointmentTypes } = useFetchAppointmentTypes();

  const [ step, setStep ] = useState(1);
  const [ saving, setSaving ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  const [ reminderChannel, setReminderChannel ] = useState<Channel>(Channel.WHATSAPP);

  const [ form, setForm ] = useState<AppointmentForm>({
    patientId: appt?.patient.id ?? "",
    startAt: appt?.startAt ?? prefillDate ?? getTommorrowSixAm(),
    status: appt?.status ?? AppointmentStatus.SCHEDULED,
    typeId: appt?.appointmentType.id ?? "",
    locationId: appt?.appointmentLocation.id ?? "",
    meetingUrl: appt?.meetingUrl ?? undefined,
    price: appt?.price ?? 0,
    paid: appt?.paid ? AppointmentPaidStatus.PAID : AppointmentPaidStatus.UNPAID,
    duration: getDuration(appt?.startAt, appt?.endAt) ?? AppointmentDuration.MIN_60,
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
    ? !!form.patientId && !!form.typeId && !!form.startAt
    : step === 2
      ? !!form.locationId && (form.reminderType !== ReminderType.NONE ? selectedChannelAvailable : true)
      : !!form.price;

  function buildReminderPayload(): Partial<Reminder> {
    const to = reminderChannel === Channel.WHATSAPP
      ? selectedPatient?.whatsappNumber || ""
      : reminderChannel === Channel.SMS
        ? selectedPatient?.smsNumber || ""
        : selectedPatient?.email || "";

    return {
      to,
      contentSid: "HX37ade446b4d27706eefce63ee11d1528",
      contentVariables: {
        "1": getDate(form.startAt),
        "2": formatTime(form.startAt)
      },
      body: REMINDER_TEMPLATE.replace("{{1}}", formatDate(form.startAt)).replace("{{2}}", formatTime(form.startAt)),
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
      paid: form.paid === AppointmentPaidStatus.PAID,
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
        {step === 1 && <PatientAndTypeStep form={form} setForm={setForm} patients={patients} isEdit={isEdit} selectedPatient={selectedPatient} appointmentTypes={appointmentTypes} />}
        {step === 2 && <LocationAndTimeStep form={form} set={set} setForm={setForm} selectedPatient={selectedPatient} reminderChannel={reminderChannel} setReminderChannel={setReminderChannel} locations={locations} />}
        {step === 3 && <PaymentAndStatusStep form={form} set={set} setForm={setForm} selectedPatient={selectedPatient} locations={locations} appointmentTypes={appointmentTypes} />}
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

function PatientAndTypeStep({ form, setForm, patients, isEdit, selectedPatient, appointmentTypes }: { form: AppointmentForm; setForm: React.Dispatch<React.SetStateAction<AppointmentForm>>; patients: Patient[]; isEdit: boolean; selectedPatient: Patient | undefined; appointmentTypes: AppointmentType[] }) {
  return (<div className="form-stack">
    {!isEdit && <label className="form-label">
      <RequiredField label="Paciente" />
      <CustomSelect
        value={form.patientId}
        placeholder="Seleccionar paciente…"
        options={patients.length > 0 ? patients.filter(p => p.status === "ACTIVE").map(p => ({ value: p.id, label: `${p.name} ${p.lastName}` })) : [ { value: "", label: "No hay pacientes registrados" } ]}
        onChange={(v) => setForm(f => ({ ...f, patientId: v }))}
      />
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
      <CustomSelect
        value={form.typeId}
        placeholder="Seleccionar tipo…"
        options={appointmentTypes.map(t => ({ value: t.id, label: t.name }))}
        onChange={(v) => setForm(f => ({ ...f, typeId: v, price: appointmentTypes.find(t => t.id === v)?.defaultPrice ?? 0, duration: AppointmentDuration.MIN_60 }))}
      />
    </label>
  </div>)
}

function LocationAndTimeStep({ form, set, setForm, selectedPatient, reminderChannel, setReminderChannel, locations }: { form: AppointmentForm; set: SetField; setForm: React.Dispatch<React.SetStateAction<AppointmentForm>>; selectedPatient: Patient | undefined; reminderChannel: Channel; setReminderChannel: (c: Channel) => void; locations: AppointmentLocation[] }) {
  const setField = (field: keyof AppointmentForm) => (value: string) => setForm(f => ({ ...f, [ field ]: value }));

  return (
    <div className="form-stack">
      <label className="form-label">
        <RequiredField label="Duración" />
        <CustomSelect
          value={form.duration}
          options={Object.values(AppointmentDuration).map(d => ({ value: d, label: d }))}
          onChange={setField("duration")}
        />
      </label>

      <label className="form-label">
        <RequiredField label="Ubicación" />
        <CustomSelect
          value={form.locationId}
          placeholder="Seleccionar ubicación…"
          options={locations.map(d => ({ value: d.id, label: d.name }))}
          onChange={setField("locationId")}
        />
      </label>

      {locations.find(l => l.id === form.locationId)?.isVirtual && (
        <label className="form-label">
          URL de videollamada
          <input type="url" className="form-input" value={form.meetingUrl} onChange={set("meetingUrl")} placeholder="https://meet.example.com/sala" />
        </label>
      )}
      {selectedPatient?.whatsappNumber || selectedPatient?.email || selectedPatient?.smsNumber ?
        <div>
          <label className="form-label">
            Recordatorio
            <CustomSelect
              value={form.reminderType}
              options={[
                { value: ReminderType.NONE, label: "Sin recordatorio" },
                { value: ReminderType.ONE_HOUR_BEFORE, label: "1 hora antes", disabled: !isReminderTypeFeasible(form.startAt, ReminderType.ONE_HOUR_BEFORE) },
                { value: ReminderType.ONE_DAY_BEFORE, label: "1 día antes", disabled: !isReminderTypeFeasible(form.startAt, ReminderType.ONE_DAY_BEFORE) },
                { value: ReminderType.ONE_WEEK_BEFORE, label: "1 semana antes", disabled: !isReminderTypeFeasible(form.startAt, ReminderType.ONE_WEEK_BEFORE) },
              ]}
              onChange={setField("reminderType")}
            />
          </label>
          {form.reminderType !== ReminderType.NONE && (
            <div>
              <div className="channel-section-label">Canal de notificación</div>
              <div style={{ display: "flex", gap: 10 }}>
                {Object.values(Channel).map(c => {
                  const available = (c === Channel.WHATSAPP && !!selectedPatient?.whatsappNumber) || (c === Channel.SMS && !!selectedPatient?.smsNumber)// || (c === Channel.EMAIL && !!selectedPatient?.email);
                  return (
                    <button
                      key={c}
                      onClick={() => available && setReminderChannel(c)}
                      className={`selection-card${reminderChannel === c ? " selection-card--active" : ""}${!available ? " selection-card--disabled" : ""}`}
                      style={{ flex: 1 }}
                    >
                      <span style={{ fontSize: 22 }}>{CHANNEL_CFG[ c ].icon}</span>
                      <div style={{ textAlign: "left" }}>
                        <div className="patient-preview__name">{CHANNEL_CFG[ c ].label}</div>
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

function PaymentAndStatusStep({ form, set, setForm, selectedPatient, locations, appointmentTypes }: { form: AppointmentForm; set: SetField; setForm: React.Dispatch<React.SetStateAction<AppointmentForm>>; selectedPatient: Patient | undefined; locations: AppointmentLocation[]; appointmentTypes: AppointmentType[] }) {
  const setField = (field: keyof AppointmentForm) => (value: string) => setForm(f => ({ ...f, [ field ]: value }));

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
          Pago
          <CustomSelect
            value={form.paid}
            options={(Object.keys(APPT_PAID_STATUS_CFG) as AppointmentPaidStatus[]).map(s => ({ value: s, label: `${APPT_PAID_STATUS_CFG[ s ].icon} ${APPT_PAID_STATUS_CFG[ s ].label}` }))}
            onChange={setField("paid")}
          />
        </label>
        <label className="form-label">
          Estado
          <CustomSelect
            value={form.status}
            options={(Object.keys(APPT_STATUS_CFG) as AppointmentStatus[]).map(s => ({ value: s, label: `${APPT_STATUS_CFG[ s ].icon} ${APPT_STATUS_CFG[ s ].label}` }))}
            onChange={setField("status")}
          />
        </label>
      </div>

      <div className="summary-card">
        <div className="summary-card__label">Resumen</div>
        {[
          [ "Paciente", selectedPatient ? `${selectedPatient.name} ${selectedPatient.lastName}` : "—" ],
          [ "Tipo", appointmentTypes.find(t => t.id === form.typeId)?.name || "—" ],
          [ "Fecha", `${formatDate(form.startAt)} a las ${formatTime(form.startAt)}` ],
          [ "Duración", form.duration ],
          [ "Ubicación", locations.find(l => l.id === form.locationId)?.name || "—" ],
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
