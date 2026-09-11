import {
  Reminder,
  REMINDER_STATUS_CONFIG,
  ReminderStatus,
  ReminderMode,
  Channel,
  CHANNEL_CFG,
  MAX_RETRIES,
} from "@/src/types/Reminder";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import { AppointmentStatusPill, ReminderStatusPill } from "../Info/StatusPill";
import { LinkedCard, Section, Row } from "./DrawerUtils";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { APPT_STATUS_CFG } from "@/src/types/Appointment";
import { ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";
import Link from "next/link";
import { useFetchReminder } from "@/src/api/reminders/useFetchReminder";

export function ReminderDrawer({
  reminder: initialReminder,
  onClose,
  onEdit,
  onCancel,
  onRetry,
  retryLoading,
  onViewPatient,
  onViewAppointment,
}: {
  reminder: Reminder;
  onClose: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  retryLoading?: boolean;
  onViewPatient?: (patient: NonNullable<Reminder["patient"]>) => void;
  onViewAppointment?: (appointment: NonNullable<Reminder["appointment"]>) => void;
}) {
  const needsDetails = !initialReminder.createdAt ||
    !initialReminder.updatedAt ||
    !initialReminder.to ||
    !initialReminder.sendMode;
  const { reminder: fetchedReminder, error } = useFetchReminder(
    needsDetails ? initialReminder.id : null,
  );
  const reminder = fetchedReminder ?? initialReminder;

  if (needsDetails && !fetchedReminder) {
    return (
      <div className="drawer-overlay" onClick={onClose}>
        <div className="drawer-backdrop" />
        <div className="drawer-panel" onClick={(e) => e.stopPropagation()} data-testid="reminder-drawer-panel">
          <div className="drawer-header">
            <div className="drawer-header__top">
              <h2 className="drawer-header__title">Recordatorio</h2>
              <button onClick={onClose} className="btn-close--transparent" data-testid="reminder-drawer-close-button">
                <ACTION_ICONS.close size={16} />
              </button>
            </div>
          </div>
          <div className="drawer-body">
            <div className="text-muted">{error ? "No se pudo cargar el recordatorio" : "Cargando recordatorio..."}</div>
          </div>
        </div>
      </div>
    );
  }

  const s = REMINDER_STATUS_CONFIG[ reminder.status ];
  const isActive = reminder.status === ReminderStatus.PENDING || reminder.status === ReminderStatus.QUEUED;
  const isFailed = reminder.status === ReminderStatus.FAILED;
  const retriesExhausted = isFailed && (reminder.retryCount ?? 0) > MAX_RETRIES;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-backdrop" />
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()} data-testid="reminder-drawer-panel">
        <div
          className="drawer-header"
          style={{ background: s.bg, borderBottom: `3px solid ${s.dot}` }}
        >
          <div className="drawer-header__top">
            <div>
              <h2 className="drawer-header__title">
                {CHANNEL_CFG[ reminder.channel ].label}
              </h2>
              <div className="drawer-header__status">
                <ReminderStatusPill status={reminder.status} />
              </div>
            </div>
            <button onClick={onClose} className="btn-close--transparent" data-testid="reminder-drawer-close-button">
              <ACTION_ICONS.close size={16} />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          {reminder.patient && (
            <Section title="Paciente">
              <div
                className={`td-identity${onViewPatient ? " linked-card--interactive" : ""}`}
                onClick={() => reminder.patient && onViewPatient?.(reminder.patient)}
                onKeyDown={(event) => {
                  if (reminder.patient && onViewPatient && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onViewPatient(reminder.patient);
                  }
                }}
                role={onViewPatient ? "button" : undefined}
                tabIndex={onViewPatient ? 0 : undefined}
              >
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
              {(reminder.channel === Channel.SMS ||
                reminder.channel === Channel.WHATSAPP) && (
                  <Row
                    icon={DETAIL_ICONS.phone}
                    label="Número"
                    value={<span className="mono">{reminder.to}</span>}
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
                <LinkedCard
                  key={reminder.appointment.id}
                  onClick={onViewAppointment ? () => onViewAppointment(reminder.appointment!) : undefined}
                  style={{
                    borderLeft: `3px solid ${APPT_STATUS_CFG[ reminder.appointment.status ].dot}`,
                  }}
                  testId={`reminder-drawer-appointment-card-${reminder.appointment.id}`}
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
                </LinkedCard>
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
              label="Twilio ID"
              value={<span className="mono">{reminder.messageId ?? "-"}</span>}
            />
            <Link
              href={`/settings?tab=Registro+de+actividad&entityId=${reminder.id}`}
              className="btn-secondary btn-primary--block"
              style={{ marginTop: 12, textDecoration: "none" }}
            >
              <DETAIL_ICONS.history size={14} /> Ver registros de actividad
            </Link>
          </Section>
        </div>
        {isActive && (onEdit || onCancel) && (
          <div className="drawer-footer">
            {onEdit && (
              <button onClick={onEdit} className="btn-primary btn-primary--block" data-testid="reminder-drawer-reschedule-button">
                <ACTION_ICONS.edit size={14} /> Reprogramar
              </button>
            )}
            {onCancel && (
              <button onClick={onCancel} className="btn-drawer-delete" data-testid="reminder-drawer-cancel-button">
                <ACTION_ICONS.delete size={14} />
              </button>
            )}
          </div>
        )}
        {isFailed && onRetry && (
          <div className="drawer-footer">
            <button
              onClick={onRetry}
              disabled={retryLoading || retriesExhausted}
              title={retriesExhausted ? 'Máximo de reintentos alcanzado' : undefined}
              className="btn-primary btn-primary--block"
              data-testid="reminder-drawer-retry-button"
            >
              <ACTION_ICONS.retry size={14} /> {retryLoading ? 'Reintentando…' : 'Reintentar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
