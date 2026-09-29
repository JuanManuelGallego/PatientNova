import Link from "next/link";
import {
  Appointment,
  AppointmentStatus,
} from "@/src/types/Appointment";
import { CHANNEL_CFG } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import {
  fmtDate,
  fmtDateTime,
  fmtTime,
  getDuration,
} from "@/src/utils/TimeUtils";
import {
  DrawerShell,
  DrawerState,
  LinkedCard,
  Section,
  Row,
} from "./DrawerUtils";
import { ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";
import { PayStatusPill } from "../Info/PayStatusPill";
import { AppointmentStatusPill, ReminderStatusPill } from "../Info/StatusPill";
import { useFetchAppointment } from "@/src/api/appointments/useFetchAppointment";

export function AppointmentDrawer({
  appt,
  onClose,
  onEdit,
  onPay,
  onDelete,
  onViewPatient,
  onViewReminder,
}: {
  appt: Appointment;
  onClose: () => void;
  onEdit?: () => void;
  onPay?: () => void;
  onDelete?: () => void;
  onViewPatient?: (patient: Appointment["patient"]) => void;
  onViewReminder?: (reminder: NonNullable<Appointment["reminder"]>) => void;
}) {
  const needsDetails = !appt.patient || !appt.appointmentLocation || !appt.appointmentType;
  const { appointment: fetchedAppointment, error } = useFetchAppointment(
    needsDetails ? appt.id : null,
  );
  const appointment = fetchedAppointment ?? appt;

  if (needsDetails && !fetchedAppointment) {
    return (
      <DrawerShell
        title="Cita"
        eyebrow="Detalles de la cita"
        icon={DETAIL_ICONS.calendar}
        onClose={onClose}
        panelTestId="appointment-drawer-panel"
        closeTestId="appointment-drawer-close-button"
      >
        <DrawerState
          message={error ? "No se pudo cargar la cita" : "Cargando cita…"}
          error={Boolean(error)}
        />
      </DrawerShell>
    );
  }

  const footer = (onEdit || onDelete) ? (
    <>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="btn-primary btn-primary--block"
          data-testid="appointment-drawer-edit-button"
        >
          <ACTION_ICONS.edit size={16} aria-hidden="true" /> Editar
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="btn-drawer-delete"
          aria-label="Cancelar cita"
          title="Cancelar cita"
          data-testid="appointment-drawer-delete-button"
        >
          <ACTION_ICONS.delete size={16} aria-hidden="true" />
        </button>
      )}
    </>
  ) : undefined;

  return (
    <DrawerShell
      title={appointment.appointmentType.name}
      eyebrow="Detalles de la cita"
      icon={DETAIL_ICONS.calendar}
      status={<AppointmentStatusPill status={appointment.status} />}
      footer={footer}
      onClose={onClose}
      panelTestId="appointment-drawer-panel"
      closeTestId="appointment-drawer-close-button"
      titleTestId="appointment-drawer-type-name"
    >
      <Section title="Paciente" testId="appointment-drawer-section-paciente">
        <LinkedCard
          onClick={onViewPatient ? () => onViewPatient(appointment.patient) : undefined}
          className="drawer-identity"
        >
          <span
            className="avatar avatar--lg"
            style={{ background: getAvatarColor(appointment.patient.id) }}
            aria-hidden="true"
          >
            {getInitials(appointment.patient.name, appointment.patient.lastName)}
          </span>
          <span className="drawer-identity__copy">
            <span
              className="drawer-patient__name"
              data-testid="appointment-drawer-patient-name"
            >
              {appointment.patient.name} {appointment.patient.lastName}
            </span>
            <span className="text-muted" data-testid="appointment-drawer-patient-email">
              {appointment.patient.email}
            </span>
          </span>
        </LinkedCard>
      </Section>

      <Section title="Fecha y Hora" testId="appointment-drawer-section-fecha-hora">
        <Row icon={DETAIL_ICONS.calendar} label="Fecha" value={fmtDate(appointment.startAt)} testId="appointment-drawer-date" />
        <Row icon={DETAIL_ICONS.clock} label="Hora" value={fmtTime(appointment.startAt)} testId="appointment-drawer-time" />
        <Row icon={DETAIL_ICONS.timer} label="Duración" value={getDuration(appointment.startAt, appointment.endAt)} testId="appointment-drawer-duration" />
      </Section>

      <Section title="Lugar" testId="appointment-drawer-section-lugar">
        <Row icon={DETAIL_ICONS.mapPin} label="Ubicación" value={appointment.appointmentLocation.name} testId="appointment-drawer-location" />
        {appointment.meetingUrl && (
          <a
            href={appointment.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="drawer-link"
            data-testid="appointment-drawer-meeting-link"
          >
            <DETAIL_ICONS.link size={15} aria-hidden="true" />
            <span>Unirse a la videollamada</span>
          </a>
        )}
      </Section>

      <Section title="Pago" testId="appointment-drawer-section-pago">
        <Row icon={DETAIL_ICONS.dollar} label="Precio" value={`$${appointment.price}`} testId="appointment-drawer-price" />
        <div className="drawer-action-row">
          <Row icon={DETAIL_ICONS.creditCard} label="Estado" value={<PayStatusPill paid={appointment.paid} />} testId="appointment-drawer-paid-status" />
          {!appointment.paid && appointment.status !== AppointmentStatus.CANCELLED && onPay && (
            <button type="button" onClick={onPay} className="btn-primary btn-primary--success" data-testid="appointment-drawer-pay-button">
              Marcar pagado
            </button>
          )}
        </div>
      </Section>

      <Section title="Notas" testId="appointment-drawer-section-notas">
        <Row icon={DETAIL_ICONS.note} label="Notas" value={appointment.notes || "Ninguna Nota"} testId="appointment-drawer-notes" />
      </Section>

      {appointment.reminder && (
        <Section title="Recordatorio Vinculado">
          <div className="card-list">
            <LinkedCard
              onClick={onViewReminder ? () => onViewReminder(appointment.reminder!) : undefined}
              icon={DETAIL_ICONS.megaphone}
              testId={`appointment-drawer-reminder-card-${appointment.reminder.id}`}
            >
              <span className="linked-card__header">
                <span className="linked-card__copy">
                  <span className="linked-card__title">{CHANNEL_CFG[appointment.reminder.channel].label}</span>
                  <span className="linked-card__meta">{fmtDateTime(appointment.reminder.sendAt.toString())}</span>
                </span>
                <ReminderStatusPill status={appointment.reminder.status} />
              </span>
            </LinkedCard>
          </div>
        </Section>
      )}

      <Section title="Información del sistema" quiet>
        <Row icon={DETAIL_ICONS.id} label="ID" value={<span className="mono-sm">{appointment.id}</span>} />
        <Row icon={DETAIL_ICONS.calendar} label="Creada" value={new Date(appointment.createdAt).toLocaleString("es-ES")} />
        <Link href={`/settings?tab=Registro+de+actividad&entityId=${appointment.id}`} className="drawer-link" data-testid="appointment-drawer-audit-link">
          <DETAIL_ICONS.history size={15} aria-hidden="true" /> Ver registros de actividad
        </Link>
      </Section>
    </DrawerShell>
  );
}
