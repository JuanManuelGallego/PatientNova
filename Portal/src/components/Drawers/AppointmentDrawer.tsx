import { Appointment, APPT_STATUS_CFG } from "@/src/types/Appointment";
import { CHANNEL_CFG, REMINDER_STATUS_CONFIG } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/avatarHelper";
import {
  fmtDate,
  fmtDateTime,
  fmtTime,
  getDuration,
} from "@/src/utils/timeUtils";
import { Section, Row } from "./DrawerUtils";
import { ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";
import { PayStatusPill } from "../Info/PayStatusPill";
import { AppointmentStatusPill, ReminderStatusPill } from "../Info/StatusPill";

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
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div
          className="drawer-header"
          style={{ background: s.bg, borderBottom: `3px solid ${s.dot}` }}
        >
          <div className="drawer-header__top">
            <div>
              <h2 className="drawer-header__title">
                {appt.appointmentType.name}
              </h2>
              <div className="drawer-header__status">
                <AppointmentStatusPill status={appt.status} />
              </div>
            </div>
            <button onClick={onClose} className="btn-close--transparent">
              <ACTION_ICONS.close size={16} />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <Section title="Paciente">
            <div className="td-identity">
              <div
                className="avatar avatar--lg"
                style={{ background: getAvatarColor(appt.patient.id) }}
              >
                {getInitials(appt.patient.name, appt.patient.lastName)}
              </div>
              <div>
                <div className="drawer-patient__name">
                  {appt.patient.name} {appt.patient.lastName}
                </div>
                <div className="text-muted">{appt.patient.email}</div>
              </div>
            </div>
          </Section>
          <Section title="Fecha y Hora">
            <Row
              icon={DETAIL_ICONS.calendar}
              label="Fecha"
              value={fmtDate(appt.startAt)}
            />
            <Row
              icon={DETAIL_ICONS.clock}
              label="Hora"
              value={fmtTime(appt.startAt)}
            />
            <Row
              icon={DETAIL_ICONS.timer}
              label="Duración"
              value={getDuration(appt.startAt, appt.endAt)}
            />
          </Section>
          <Section title="Lugar">
            <Row
              icon={DETAIL_ICONS.mapPin}
              label="Ubicación"
              value={appt.appointmentLocation.name}
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
                >
                  Unirse a la videollamada
                </a>
              </div>
            )}
          </Section>
          <Section title="Pago">
            <Row
              icon={DETAIL_ICONS.dollar}
              label="Precio"
              value={`$${appt.price}`}
            />
            <div className="row-between">
              <Row
                icon={DETAIL_ICONS.creditCard}
                label="Estado"
                value={<PayStatusPill paid={appt.paid} />}
              />
              {!appt.paid && (
                <button
                  onClick={onPay}
                  className="btn-primary btn-primary--success"
                >
                  Marcar pagado
                </button>
              )}
            </div>
          </Section>
          <Section title="Notas">
            <Row
              icon={DETAIL_ICONS.note}
              label="Notas"
              value={`${appt.notes || "Ninguna Nota"}`}
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
          </Section>
        </div>
        <div className="drawer-footer">
          <button onClick={onEdit} className="btn-primary btn-primary--block">
            <ACTION_ICONS.edit size={14} /> Editar
          </button>
          <button onClick={onDelete} className="btn-drawer-delete">
            <ACTION_ICONS.delete size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
