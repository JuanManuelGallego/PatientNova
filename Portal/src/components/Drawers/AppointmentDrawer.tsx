import { Appointment, APPT_STATUS_CFG, AppointmentStatus } from "@/src/types/Appointment";
import { CHANNEL_CFG, REMINDER_STATUS_CONFIG } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import {
  fmtDate,
  fmtDateTime,
  fmtTime,
  getDuration,
} from "@/src/utils/TimeUtils";
import { Section, Row } from "./DrawerUtils";
import { ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";
import { PayStatusPill } from "../Info/PayStatusPill";
import { AppointmentStatusPill, ReminderStatusPill } from "../Info/StatusPill";
import Link from "next/link";

export function AppointmentDrawer({
  appt,
  onClose,
  onEdit,
  onPay,
  onDelete,
}: {
  appt: Appointment;
  onClose: () => void;
  onEdit: () => void;
  onPay: () => void;
  onDelete: () => void;
}) {
  const s = APPT_STATUS_CFG[ appt.status ];
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
                {appt.appointmentType.name}
              </h2>
              <div className="drawer-header__status">
                <AppointmentStatusPill status={appt.status} />
              </div>
            </div>
            <button onClick={onClose} className="btn-close--transparent" data-testid="appointment-drawer-close-button">
              <ACTION_ICONS.close size={16} />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <Section title="Paciente" testId="appointment-drawer-section-paciente">
            <div className="td-identity">
              <div
                className="avatar avatar--lg"
                style={{ background: getAvatarColor(appt.patient.id) }}
              >
                {getInitials(appt.patient.name, appt.patient.lastName)}
              </div>
              <div>
                <div className="drawer-patient__name" data-testid="appointment-drawer-patient-name">
                  {appt.patient.name} {appt.patient.lastName}
                </div>
                <div className="text-muted" data-testid="appointment-drawer-patient-email">{appt.patient.email}</div>
              </div>
            </div>
          </Section>
          <Section title="Fecha y Hora" testId="appointment-drawer-section-fecha-hora">
            <Row
              icon={DETAIL_ICONS.calendar}
              label="Fecha"
              value={fmtDate(appt.startAt)}
              testId="appointment-drawer-date"
            />
            <Row
              icon={DETAIL_ICONS.clock}
              label="Hora"
              value={fmtTime(appt.startAt)}
              testId="appointment-drawer-time"
            />
            <Row
              icon={DETAIL_ICONS.timer}
              label="Duración"
              value={getDuration(appt.startAt, appt.endAt)}
              testId="appointment-drawer-duration"
            />
          </Section>
          <Section title="Lugar" testId="appointment-drawer-section-lugar">
            <Row
              icon={DETAIL_ICONS.mapPin}
              label="Ubicación"
              value={appt.appointmentLocation.name}
              testId="appointment-drawer-location"
            />
            {appt.meetingUrl && (
              <div className="detail-row">
                <span className="detail-row__icon">
                  <DETAIL_ICONS.link size={14} />
                </span>
                <a
                  href={appt.meetingUrl}
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
              value={`$${appt.price}`}
              testId="appointment-drawer-price"
            />
            <div className="row-between">
              <Row
                icon={DETAIL_ICONS.creditCard}
                label="Estado"
                value={<PayStatusPill paid={appt.paid} />}
                testId="appointment-drawer-paid-status"
              />
              {!appt.paid && appt.status !== AppointmentStatus.CANCELLED && (
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
              value={`${appt.notes || "Ninguna Nota"}`}
              testId="appointment-drawer-notes"
            />
          </Section>
          {appt.reminder && (
            <Section title="Recordatorio Vinculado">
              <div className="card-list">
                <div
                  key={appt.reminder.id}
                  className="linked-card"
                  style={{
                    borderLeft: `3px solid ${REMINDER_STATUS_CONFIG[ appt.reminder.status ].dot}`,
                  }}
                >
                  <div className="linked-card__header">
                    <div>
                      <div className="linked-card__title">
                        {CHANNEL_CFG[ appt.reminder.channel ].label}
                      </div>
                      <div className="linked-card__meta">
                        {fmtDateTime(appt.reminder.sendAt.toString())}
                      </div>
                    </div>
                    <ReminderStatusPill status={appt.reminder.status} />
                  </div>
                </div>
              </div>
            </Section>
          )}
          <Section title="Información del sistema">
            <Row
              icon={DETAIL_ICONS.id}
              label="ID"
              value={<span className="mono-sm">{appt.id}</span>}
            />
            <Row
              icon={DETAIL_ICONS.calendar}
              label="Creada"
              value={new Date(appt.createdAt).toLocaleString("es-ES")}
            />
            <Link
              href={`/settings?tab=Registro+de+actividad&entityId=${appt.id}`}
              className="btn-secondary btn-primary--block"
              style={{ marginTop: 12, textDecoration: "none" }}
              data-testid="appointment-drawer-audit-link"
            >
              <DETAIL_ICONS.history size={14} /> Ver registros de actividad
            </Link>
          </Section>
        </div>
        <div className="drawer-footer">
          <button onClick={onEdit} className="btn-primary btn-primary--block" data-testid="appointment-drawer-edit-button">
            <ACTION_ICONS.edit size={14} /> Editar
          </button>
          <button onClick={onDelete} className="btn-drawer-delete" data-testid="appointment-drawer-delete-button">
            <ACTION_ICONS.delete size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
