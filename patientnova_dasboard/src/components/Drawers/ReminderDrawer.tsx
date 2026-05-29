import {
  Reminder,
  REMINDER_STATUS_CONFIG,
  ReminderStatus,
  ReminderMode,
  Channel,
  CHANNEL_CFG,
} from "@/src/types/Reminder";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import { AppointmentStatusPill, ReminderStatusPill } from "../Info/StatusPill";
import { Section, Row } from "./DrawerUtils";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { APPT_STATUS_CFG } from "@/src/types/Appointment";
import { ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";

export function ReminderDrawer({
  reminder,
  onClose,
  onEdit,
  onCancel,
}: {
  reminder: Reminder;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const s = REMINDER_STATUS_CONFIG[reminder.status];
  const isActive =
    reminder.status === ReminderStatus.PENDING ||
    reminder.status === ReminderStatus.QUEUED;

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
                {CHANNEL_CFG[reminder.channel].label}
              </h2>
              <div className="drawer-header__status">
                <ReminderStatusPill status={reminder.status} />
              </div>
            </div>
            <button onClick={onClose} className="btn-close--transparent">
              <ACTION_ICONS.close size={16} />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          {reminder.patient && (
            <Section title="Paciente">
              <div className="td-identity">
                <div
                  className="avatar avatar--lg"
                  style={{ background: getAvatarColor(reminder.patient?.id) }}
                >
                  {getInitials(
                    reminder.patient?.name,
                    reminder.patient?.lastName,
                  )}
                </div>
                <div>
                  <div className="drawer-patient__name">
                    {reminder.patient?.name} {reminder.patient?.lastName}
                  </div>
                </div>
              </div>
              {(reminder.channel == Channel.SMS ||
                reminder.channel == Channel.WHATSAPP) && (
                <Row
                  icon={DETAIL_ICONS.phone}
                  label="Número"
                  value={<span className="mono">{reminder.to}</span>}
                />
              )}
              {reminder.channel == Channel.EMAIL && (
                <Row
                  icon={DETAIL_ICONS.mail}
                  label="Correo"
                  value={<a href={`mailto:${reminder.to}`}>{reminder.to}</a>}
                />
              )}
            </Section>
          )}
          <Section title="Programación">
            <Row
              icon={DETAIL_ICONS.megaphone}
              label="Modo"
              value={
                reminder.sendMode === ReminderMode.IMMEDIATE
                  ? "Inmediato"
                  : "Programado"
              }
            />
            <Row
              icon={DETAIL_ICONS.clock}
              label={isActive ? "Se envia el" : "Enviado el"}
              value={fmtDateTime(reminder.sendAt)}
            />
            {reminder.sendAt && (
              <Row
                icon={DETAIL_ICONS.calendar}
                label="Programado"
                value={fmtDateTime(reminder.createdAt)}
              />
            )}
          </Section>
          {reminder.error && (
            <Section title="Error">
              <div className="error-inline">{reminder.error}</div>
            </Section>
          )}
          {reminder.appointment && (
            <Section title="Citas Vinculadas">
              <div className="card-list">
                <div
                  key={reminder.appointment.id}
                  className="linked-card"
                  style={{
                    borderLeft: `3px solid ${APPT_STATUS_CFG[reminder.appointment.status].dot}`,
                  }}
                >
                  <div className="linked-card__header">
                    <div>
                      <div className="linked-card__title">
                        {reminder.appointment.appointmentType.name}
                      </div>
                      <div className="linked-card__meta">
                        {fmtDateTime(reminder.appointment.startAt.toString())}
                      </div>
                    </div>
                    <AppointmentStatusPill
                      status={reminder.appointment.status}
                    />
                  </div>
                  <div className="linked-card__footer">
                    <span>{reminder.appointment.appointmentLocation.name}</span>
                    {reminder.appointment.paid && <span>Pagada</span>}
                  </div>
                </div>
              </div>
            </Section>
          )}
          <Section title="Mensaje">
            <Row
              icon={DETAIL_ICONS.mail}
              label="Mensaje"
              value={<span className="mono">{reminder.contentSid}</span>}
            />
          </Section>
          <Section title="Información del sistema">
            <Row
              icon={DETAIL_ICONS.id}
              label="ID"
              value={<span className="mono-sm">{reminder.id}</span>}
            />
            <Row
              icon={DETAIL_ICONS.calendar}
              label="Creado"
              value={fmtDateTime(reminder.createdAt)}
            />
            <Row
              icon={DETAIL_ICONS.refresh}
              label="Actualizado"
              value={fmtDateTime(reminder.updatedAt)}
            />
            <Row
              icon={DETAIL_ICONS.id}
              label="Twillo ID"
              value={<span className="mono">{reminder.messageId ?? "-"}</span>}
            />
          </Section>
        </div>
        {isActive && (
          <div className="drawer-footer">
            <button onClick={onEdit} className="btn-primary btn-primary--block">
              <ACTION_ICONS.edit size={14} /> Reprogramar
            </button>
            <button onClick={onCancel} className="btn-drawer-delete">
              <ACTION_ICONS.delete size={14} /> Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
