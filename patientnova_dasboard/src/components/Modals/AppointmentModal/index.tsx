"use client";

import { useCreateAppointment } from "@/src/api/useCreateAppointment";
import { useUpdateAppointment } from "@/src/api/useUpdateAppointment";
import { useFetchAppointments } from "@/src/api/useFetchAppointments";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import { useFetchAppointmentTypes } from "@/src/api/useFetchAppointmentTypes";
import { useFetchLocations } from "@/src/api/useFetchLocations";
import {
  Appointment,
  AppointmentForm,
  AppointmentStatus,
  AppointmentDuration,
  AppointmentPaidStatus,
  DEFAULT_APPT_STATUS,
} from "@/src/types/Appointment";
import {
  ReminderType,
  ReminderMode,
  ReminderStatus,
  Channel,
  type ReminderInlineData,
} from "@/src/types/Reminder";
import { getUserName } from "@/src/utils/AvatarHelper";
import {
  fmtDate,
  fmtTime,
  getDuration,
  getRemindersendAt,
  getAppointmentEndTime,
  getTomorrowSixAm,
  getReminderType,
} from "@/src/utils/TimeUtils";
import { TWILIO_CONFIG } from "@/src/utils/twilioConfig";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { useAuthContext } from "@/src/app/AuthContext";
import {
  LBL_SAVE_CHANGES,
  LBL_CREATE_APPOINTMENT,
  LBL_SAVING,
  LBL_BACK,
} from "@/src/constants/ui";
import { useState } from "react";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import { PatientAndTypeStep } from "./PatientAndTypeStep";
import { LocationAndTimeStep } from "./LocationAndTimeStep";
import { PaymentAndStatusStep } from "./PaymentAndStatusStep";

export function AppointmentModal({
  appt,
  prefillDate,
  onClose,
  onSaved,
}: {
  appt?: Appointment;
  prefillDate?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!appt;
  const { user } = useAuthContext();
  const { ref: trapRef, handleKeyDown: trapKeyDown } =
    useFocusTrap<HTMLDivElement>(onClose);
  const { patients } = useFetchPatients();
  const { appointments } = useFetchAppointments({
    dateFrom: getTomorrowSixAm(),
    status: DEFAULT_APPT_STATUS,
  });
  const { createAppointment } = useCreateAppointment();
  const { updateAppointment } = useUpdateAppointment();
  const { locations } = useFetchLocations();
  const { appointmentTypes } = useFetchAppointmentTypes();

  const [ step, setStep ] = useState(1);
  const [ saving, setSaving ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  const reminderChannel = user?.reminderChannel;

  const [ form, setForm ] = useState<AppointmentForm>({
    patientId: appt?.patient.id ?? "",
    startAt: appt?.startAt ?? prefillDate ?? getTomorrowSixAm(),
    status: appt?.status ?? AppointmentStatus.SCHEDULED,
    typeId: appt?.appointmentType.id ?? "",
    locationId: appt?.appointmentLocation.id ?? "",
    meetingUrl: appt?.meetingUrl ?? undefined,
    price: appt?.price ?? 0,
    paid: appt?.paid
      ? AppointmentPaidStatus.PAID
      : AppointmentPaidStatus.UNPAID,
    duration:
      getDuration(appt?.startAt, appt?.endAt) ?? AppointmentDuration.MIN_60,
    reminderType: appt?.reminder
      ? getReminderType(appt.startAt, appt.reminder.sendAt)
      : ReminderType.NONE,
    notes: appt?.notes ?? undefined,
  });

  const set =
    (field: keyof AppointmentForm) =>
      (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) =>
        setForm((f) => ({ ...f, [ field ]: e.target.value }));

  const setPrice =
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }));

  const selectedPatient = patients.find((p) => p.id === form.patientId);
  const selectedLocation = locations.find((l) => l.id === form.locationId);

  const selectedChannelAvailable = reminderChannel
    ? reminderChannel === Channel.WHATSAPP
      ? !!selectedPatient?.whatsappNumber
      : reminderChannel === Channel.SMS
        ? !!selectedPatient?.smsNumber
        : !!selectedPatient?.email
    : false;

  const isValid =
    step === 1
      ? !!form.patientId && !!form.typeId && !!form.startAt
      : step === 2
        ? !!form.locationId &&
        (form.reminderType !== ReminderType.NONE
          ? selectedChannelAvailable
          : true)
        : !!form.price;

  function buildReminderPayload(): ReminderInlineData {
    const channel = reminderChannel!;
    const to =
      channel === Channel.WHATSAPP
        ? selectedPatient?.whatsappNumber || ""
        : channel === Channel.SMS
          ? selectedPatient?.smsNumber || ""
          : selectedPatient?.email || "";

    if (selectedLocation?.isVirtual) {
      return {
        to,
        contentSid:
          TWILIO_CONFIG.PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_VIRTUAL
            .contentSid,
        contentVariables: {
          "1": selectedPatient ? `${selectedPatient.name}` : "",
          "2": getUserName(user) || "su profesional de salud",
          "3": fmtDate(form.startAt),
          "4": fmtTime(form.startAt),
          "5": form.meetingUrl || "{{5}}", // backend will populate when creating the meetink link if not provided
        },
        body: TWILIO_CONFIG.PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_VIRTUAL.template
          .replace("{{1}}", selectedPatient ? `${selectedPatient.name}` : "")
          .replace("{{2}}", getUserName(user) || "su profesional de salud")
          .replace("{{3}}", fmtDate(form.startAt))
          .replace("{{4}}", fmtTime(form.startAt))
          .replace("{{5}}", form.meetingUrl || "{{5}}"),
        channel: channel,
        sendMode: ReminderMode.SCHEDULED,
        status: ReminderStatus.PENDING,
        sendAt: getRemindersendAt(form.startAt, form.reminderType),
      };
    }

    return {
      to,
      contentSid:
        TWILIO_CONFIG.PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_PRESENTIAL
          .contentSid,
      contentVariables: {
        "1": selectedPatient ? `${selectedPatient.name}` : "",
        "2": getUserName(user) || "su profesional de salud",
        "3": fmtDate(form.startAt),
        "4": fmtTime(form.startAt),
        "5": selectedLocation?.address || "No hay dirección registrada",
        "6":
          selectedLocation?.instructions || "No hay instrucciones registradas",
      },
      body: TWILIO_CONFIG.PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_PRESENTIAL.template
        .replace("{{1}}", selectedPatient ? `${selectedPatient.name}` : "")
        .replace("{{2}}", getUserName(user) || "su profesional de salud")
        .replace("{{3}}", fmtDate(form.startAt))
        .replace("{{4}}", fmtTime(form.startAt))
        .replace(
          "{{5}}",
          selectedLocation?.address || "No hay dirección registrada",
        )
        .replace(
          "{{6}}",
          selectedLocation?.instructions || "No hay instrucciones registradas",
        ),
      channel: channel,
      sendMode: ReminderMode.SCHEDULED,
      status: ReminderStatus.PENDING,
      sendAt: getRemindersendAt(form.startAt, form.reminderType),
    };
  }

  function buildAppointmentPayload(): Omit<Partial<Appointment>, 'reminder'> {
    return {
      ...form,
      endAt: getAppointmentEndTime(
        form.startAt,
        form.duration as AppointmentDuration,
      ),
      paid: form.paid === AppointmentPaidStatus.PAID,
    };
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        let reminderData: ReminderInlineData | null | undefined = undefined;
        if (appt!.reminder) {
          if (form.reminderType === ReminderType.NONE) {
            reminderData = null;
          } else {
            reminderData = buildReminderPayload();
          }
        } else if (form.reminderType !== ReminderType.NONE) {
          reminderData = buildReminderPayload();
        }
        await updateAppointment(appt!.id, {
          ...buildAppointmentPayload(),
          ...(reminderData !== undefined && { reminder: reminderData }),
        });
      } else {
        const reminderData = form.reminderType !== ReminderType.NONE
          ? buildReminderPayload()
          : undefined;
        await createAppointment({
          ...buildAppointmentPayload(),
          reminder: reminderData,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  const bookedSlots = appointments
    .filter((a) => a.id !== appt?.id)
    .map((a) => a.startAt);
  const steps = [ "Paciente & Tipo", "Lugar & Hora", "Pago & Estado" ];

  return (
    <div
      className="modal-overlay modal-overlay--nested"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Editar Cita" : "Nueva Cita"}
      ref={trapRef}
      onKeyDown={trapKeyDown}
    >
      <div
        className="modal-panel modal-panel--lg slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header modal-header--top">
          <div>
            <h2 className="modal-title">
              {isEdit ? "Editar Cita" : "Nueva Cita"}
            </h2>
            <p className="modal-subtitle">
              {steps[ step - 1 ]} — Paso {step} de {steps.length}
            </p>
          </div>
          <button onClick={onClose} className="btn-close">
            <ACTION_ICONS.close size={16} />
          </button>
        </div>
        <div className="step-bar">
          {steps.map((_, i) => (
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
          <PatientAndTypeStep
            form={form}
            setForm={setForm}
            patients={patients}
            isEdit={isEdit}
            selectedPatient={selectedPatient}
            appointmentTypes={appointmentTypes}
            bookedSlots={bookedSlots}
            onError={(error) => setError(error)}
            clearError={() => setError(null)}
          />
        )}
        {step === 2 && (
          <LocationAndTimeStep
            form={form}
            set={set}
            setForm={setForm}
            selectedPatient={selectedPatient}
            reminderChannel={reminderChannel}
            locations={locations}
          />
        )}
        {step === 3 && (
          <PaymentAndStatusStep
            form={form}
            set={set}
            setPrice={setPrice}
            setForm={setForm}
            selectedPatient={selectedPatient}
            locations={locations}
            appointmentTypes={appointmentTypes}
          />
        )}
        <div className="modal-footer">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="btn-secondary"
              disabled={saving}
            >
              {LBL_BACK}
            </button>
          )}
          {step < steps.length ? (
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
              disabled={saving || !isValid}
              className="btn-primary"
            >
              {saving
                ? LBL_SAVING
                : isEdit
                  ? LBL_SAVE_CHANGES
                  : LBL_CREATE_APPOINTMENT}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
