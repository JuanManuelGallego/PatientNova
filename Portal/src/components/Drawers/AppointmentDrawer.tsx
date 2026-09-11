import { Appointment, APPT_STATUS_CFG, AppointmentStatus } from "@/src/types/Appointment";
import { CHANNEL_CFG, REMINDER_STATUS_CONFIG } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import {
  fmtDate,
  fmtDateTime,
  fmtTime,
  getDuration,
} from "@/src/utils/TimeUtils";
import { LinkedCard, Section, Row } from "./DrawerUtils";
import { ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";
import { PayStatusPill } from "../Info/PayStatusPill";
import { AppointmentStatusPill, ReminderStatusPill } from "../Info/StatusPill";
import Link from "next/link";
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
      <div className="drawer-overlay" onClick={onClose}>
        <div className="drawer-backdrop" />
        <div className="drawer-panel" onClick={(e) => e.stopPropagation()} data-testid="appointment-drawer-panel">
          <div className="drawer-header">
            <div className="drawer-header__top">
              <h2 className="drawer-header__title">Cita</h2>
              <button onClick={onClose} className="btn-close--transparent" data-testid="appointment-drawer-close-button">
                <ACTION_ICONS.close size={16} />
              </button>
            </div>
          </div>
          <div className="drawer-body">
            <div className="text-muted">{error ? "No se pudo cargar la cita" : "Cargando cita..."}</div>
          </div>
        </div>
      </div>
    );
  }

  const s = APPT_STATUS_CFG[ appointment.status ];
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-backdrop" />
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()} data-testid="appointment-drawer-panel">
        <div
          className="drawer-header"
          style={{ background: s.bg, borderBottom: `3px solid ${s.dot}` }}
        >
          <div className="drawer-header__top">
            <div>
              <h2 className="drawer-header__title" data-testid="appointment-drawer-type-name">
                {appointment.appointmentType.name}
              </h2>
              <div className="drawer-header__status">
                <AppointmentStatusPill status={appointment.status} />
              </div>
            </div>
            <button onClick={onClose} className="btn-close--transparent" data-testid="appointment-drawer-close-button">
              <ACTION_ICONS.close size={16} />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <Section title="Paciente" testId="appointment-drawer-section-paciente">
            <div
              className={`td-identity${onViewPatient ? " linked-card--interactive" : ""}`}
              onClick={() => onViewPatient?.(appointment.patient)}
              onKeyDown={(event) => {
                if (onViewPatient && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onViewPatient(appointment.patient);
                }
              }}
              role={onViewPatient ? "button" : undefined}
              tabIndex={onViewPatient ? 0 : undefined}
            >
              <div
                className="avatar avatar--lg"
                style={{ background: getAvatarColor(appointment.patient.id) }}
              >
                {getInitials(appointment.patient.name, appointment.patient.lastName)}
              </div>
              <div>
                <div className="drawer-patient__name" data-testid="appointment-drawer-patient-name">
                  {appointment.patient.name} {appointment.patient.lastName}
                </div>
                <div className="text-muted" data-testid="appointment-drawer-patient-email">{appointment.patient.email}</div>
              </div>
            </div>
          </Section>
          <Section title="Fecha y Hora" testId="appointment-drawer-section-fecha-hora">
            <Row
              icon={DETAIL_ICONS.calendar}
              label="Fecha"
              value={fmtDate(appointment.startAt)}
              testId="appointment-drawer-date"
            />
            <Row
              icon={DETAIL_ICONS.clock}
              label="Hora"
              value={fmtTime(appointment.startAt)}
              testId="appointment-drawer-time"
            />
            <Row
              icon={DETAIL_ICONS.timer}
              label="Duración"
              value={getDuration(appointment.startAt, appointment.endAt)}
              testId="appointment-drawer-duration"
            />
          </Section>
          <Section title="Lugar" testId="appointment-drawer-section-lugar">
            <Row
              icon={DETAIL_ICONS.mapPin}
              label="Ubicación"
              value={appointment.appointmentLocation.name}
              testId="appointment-drawer-location"
            />
            {appointment.meetingUrl && (
              <div className="detail-row">
                <span className="detail-row__icon">
                  <DETAIL_ICONS.link size={14} />
                </span>
                <a
                  href={appointment.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="meeting-link"
                  data-testid="appointment-drawer-meeting-link"
                >
                  Unirse a la videollamada
                </a>
              </div>
            )}
          </Section>
          <Section title="Pago" testId="appointment-drawer-section-pago">
            <Row
              icon={DETAIL_ICONS.dollar}
              label="Precio"
              value={`$${appointment.price}`}
              testId="appointment-drawer-price"
            />
            <div className="row-between">
              <Row
                icon={DETAIL_ICONS.creditCard}
                label="Estado"
                value={<PayStatusPill paid={appointment.paid} />}
                testId="appointment-drawer-paid-status"
              />
              {!appointment.paid && appointment.status !== AppointmentStatus.CANCELLED && onPay && (
                <button
                  onClick={onPay}
                  className="btn-primary btn-primary--success"
                  data-testid="appointment-drawer-pay-button"
                >
                  Marcar pagado
                </button>
              )}
            </div>
          </Section>
          <Section title="Notas" testId="appointment-drawer-section-notas">
            <Row
              icon={DETAIL_ICONS.note}
              label="Notas"
              value={`${appointment.notes || "Ninguna Nota"}`}
              testId="appointment-drawer-notes"
            />
          </Section>
          {appointment.reminder && (
            <Section title="Recordatorio Vinculado">
              <div className="card-list">
                <LinkedCard
                  key={appointment.reminder.id}
                  onClick={onViewReminder ? () => onViewReminder(appointment.reminder!) : undefined}
                  style={{
                    borderLeft: `3px solid ${REMINDER_STATUS_CONFIG[ appointment.reminder.status ].dot}`,
                  }}
                  testId={`appointment-drawer-reminder-card-${appointment.reminder.id}`}
                >
                  <div className="linked-card__header">
                    <div>
                      <div className="linked-card__title">
                        {CHANNEL_CFG[ appointment.reminder.channel ].label}
                      </div>
                      <div className="linked-card__meta">
                        {fmtDateTime(appointment.reminder.sendAt.toString())}
                      </div>
                    </div>
                    <ReminderStatusPill status={appointment.reminder.status} />
                  </div>
                </LinkedCard>
              </div>
            </Section>
          )}
          <Section title="Información del sistema">
            <Row
              icon={DETAIL_ICONS.id}
              label="ID"
              value={<span className="mono-sm">{appointment.id}</span>}
            />
            <Row
              icon={DETAIL_ICONS.calendar}
              label="Creada"
              value={new Date(appointment.createdAt).toLocaleString("es-ES")}
            />
            <Link
              href={`/settings?tab=Registro+de+actividad&entityId=${appointment.id}`}
              className="btn-secondary btn-primary--block"
              style={{ marginTop: 12, textDecoration: "none" }}
              data-testid="appointment-drawer-audit-link"
            >
              <DETAIL_ICONS.history size={14} /> Ver registros de actividad
            </Link>
          </Section>
        </div>
        {(onEdit || onDelete) && (
          <div className="drawer-footer">
            {onEdit && (
              <button onClick={onEdit} className="btn-primary btn-primary--block" data-testid="appointment-drawer-edit-button">
                <ACTION_ICONS.edit size={14} /> Editar
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="btn-drawer-delete" data-testid="appointment-drawer-delete-button">
                <ACTION_ICONS.delete size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
