import Link from "next/link";
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
import {
  DrawerShell,
  DrawerState,
  LinkedCard,
  Section,
  Row,
} from "./DrawerUtils";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { APPT_STATUS_CFG } from "@/src/types/Appointment";
import { ACTION_ICONS, DETAIL_ICONS, NAV_ICONS } from "@/src/config/icons";
import { useFetchReminder } from "@/src/api/reminders/useFetchReminder";
import { TWILIO_CONFIG } from "@/src/utils/twilioConfig";

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
  const needsDetails =
    !initialReminder.createdAt ||
    !initialReminder.updatedAt ||
    !initialReminder.to ||
    !initialReminder.sendMode;
  const { reminder: fetchedReminder, error } = useFetchReminder(
    needsDetails ? initialReminder.id : null,
  );
  const reminder = fetchedReminder ?? initialReminder;

  if (needsDetails && !fetchedReminder) {
    return (
      <DrawerShell
        title="Recordatorio"
        eyebrow="Detalle del recordatorio"
        icon={NAV_ICONS.reminders}
        onClose={onClose}
        panelTestId="reminder-drawer-panel"
        closeTestId="reminder-drawer-close-button"
      >
        <DrawerState
          message={error ? "No se pudo cargar el recordatorio" : "Cargando recordatorio…"}
          error={Boolean(error)}
        />
      </DrawerShell>
    );
  }

  const status = REMINDER_STATUS_CONFIG[reminder.status];
  const isActive = reminder.status === ReminderStatus.PENDING || reminder.status === ReminderStatus.QUEUED;
  const isFailed = reminder.status === ReminderStatus.FAILED;
  const retriesExhausted = isFailed && (reminder.retryCount ?? 0) > MAX_RETRIES;
  const footer = isActive && (onEdit || onCancel) ? (
    <>
      {onEdit && (
        <button type="button" onClick={onEdit} className="btn-primary btn-primary--block" data-testid="reminder-drawer-reschedule-button">
          <ACTION_ICONS.edit size={16} aria-hidden="true" /> Reprogramar
        </button>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel} className="btn-drawer-delete" aria-label="Cancelar recordatorio" title="Cancelar recordatorio" data-testid="reminder-drawer-cancel-button">
          <ACTION_ICONS.delete size={16} aria-hidden="true" />
        </button>
      )}
    </>
  ) : isFailed && onRetry ? (
    <button
      type="button"
      onClick={onRetry}
      disabled={retryLoading || retriesExhausted}
      title={retriesExhausted ? "Máximo de reintentos alcanzado" : undefined}
      className="btn-primary btn-primary--block"
      data-testid="reminder-drawer-retry-button"
    >
      <ACTION_ICONS.retry size={16} aria-hidden="true" />
      {retryLoading ? "Reintentando…" : "Reintentar"}
    </button>
  ) : undefined;

  return (
    <DrawerShell
      title={CHANNEL_CFG[reminder.channel].label}
      eyebrow="Detalle del recordatorio"
      icon={NAV_ICONS.reminders}
      accent={status.dot}
      status={<ReminderStatusPill status={reminder.status} />}
      footer={footer}
      onClose={onClose}
      panelTestId="reminder-drawer-panel"
      closeTestId="reminder-drawer-close-button"
    >
      {reminder.patient && (
        <Section title="Paciente">
          <LinkedCard
            onClick={onViewPatient ? () => onViewPatient(reminder.patient!) : undefined}
            className="drawer-identity"
          >
            <span
              className="avatar avatar--lg"
              style={{ background: getAvatarColor(reminder.patient.id) }}
              aria-hidden="true"
            >
              {getInitials(reminder.patient.name, reminder.patient.lastName)}
            </span>
            <span className="drawer-identity__copy">
              <span className="drawer-patient__name">
                {reminder.patient.name} {reminder.patient.lastName}
              </span>
            </span>
          </LinkedCard>
          {(reminder.channel === Channel.SMS || reminder.channel === Channel.WHATSAPP) && (
            <Row icon={DETAIL_ICONS.phone} label="Número" value={<span className="mono">{reminder.to}</span>} />
          )}
        </Section>
      )}

      <Section title="Programación">
        <Row icon={DETAIL_ICONS.megaphone} label="Modo" value={reminder.sendMode === ReminderMode.IMMEDIATE ? "Inmediato" : "Programado"} />
        <Row icon={DETAIL_ICONS.clock} label={isActive ? "Se envia el" : "Enviado el"} value={fmtDateTime(reminder.sendAt)} />
        {reminder.sendAt && <Row icon={DETAIL_ICONS.calendar} label="Programado" value={fmtDateTime(reminder.createdAt)} />}
      </Section>

      {reminder.error && (
        <Section title="Error">
          <div className="error-inline" role="alert">{reminder.error}</div>
        </Section>
      )}

      {reminder.appointment && (
        <Section title="Citas Vinculadas">
          <div className="card-list">
            <LinkedCard
              onClick={onViewAppointment ? () => onViewAppointment(reminder.appointment!) : undefined}
              accent={APPT_STATUS_CFG[reminder.appointment.status].dot}
              testId={`reminder-drawer-appointment-card-${reminder.appointment.id}`}
            >
              <span className="linked-card__header">
                <span className="linked-card__copy">
                  <span className="linked-card__title">{reminder.appointment.appointmentType.name}</span>
                  <span className="linked-card__meta">{fmtDateTime(reminder.appointment.startAt.toString())}</span>
                </span>
                <AppointmentStatusPill status={reminder.appointment.status} />
              </span>
              <span className="linked-card__footer">
                <span>{reminder.appointment.appointmentLocation.name}</span>
                {reminder.appointment.paid && <span>Pagada</span>}
              </span>
            </LinkedCard>
          </div>
        </Section>
      )}

      <Section title="Mensaje">
        <Row
          icon={DETAIL_ICONS.mail}
          label="Mensaje"
          value={
            <span className="mono">
              {Object.values(TWILIO_CONFIG).find((value) => value.contentSid === reminder.contentSid)?.label ?? reminder.contentSid}
            </span>
          }
        />
      </Section>

      <Section title="Información del sistema" quiet>
        <Row icon={DETAIL_ICONS.id} label="ID" value={<span className="mono-sm">{reminder.id}</span>} />
        <Row icon={DETAIL_ICONS.calendar} label="Creado" value={fmtDateTime(reminder.createdAt)} />
        <Row icon={DETAIL_ICONS.refresh} label="Actualizado" value={fmtDateTime(reminder.updatedAt)} />
        <Row icon={DETAIL_ICONS.id} label="Twilio ID" value={<span className="mono">{reminder.messageId ?? "-"}</span>} />
        <Link href={`/settings?tab=Registro+de+actividad&entityId=${reminder.id}`} className="drawer-link">
          <DETAIL_ICONS.history size={15} aria-hidden="true" /> Ver registros de actividad
        </Link>
      </Section>
    </DrawerShell>
  );
}
