import { useMemo, useState } from "react";
import Link from "next/link";
import { Appointment } from "@/src/types/Appointment";
import { Patient, PatientStatus } from "@/src/types/Patient";
import { Channel } from "@/src/types/Reminder";
import { fmtDate, fmtDateTime, RelativeTime } from "@/src/utils/TimeUtils";
import {
  PatientStatusPill,
  AppointmentStatusPill,
  ReminderStatusPill,
} from "../Info/StatusPill";
import {
  DrawerShell,
  DrawerState,
  LinkedCard,
  Section,
  Row,
} from "./DrawerUtils";
import { useFetchLocations } from "@/src/api/locations/useFetchLocations";
import { useFetchAppointmentTypes } from "@/src/api/appointment-types/useFetchAppointmentTypes";
import { TabNav } from "@/src/components/TabNav";
import { useFetchPatient } from "@/src/api/patients/useFetchPatient";
import {
  ACTION_ICONS,
  DETAIL_ICONS,
  CHANNEL_ICONS,
  NAV_ICONS,
} from "@/src/config/icons";

const DRAWER_PREVIEW_TAKE = 10;

function getEmptyRelationMessage(
  relation: "citas" | "recordatorios",
  view: RelativeTime,
) {
  if (relation === "citas") {
    if (view === RelativeTime.UPCOMING) return "No hay citas próximas para este paciente.";
    if (view === RelativeTime.PAST) return "No hay citas pasadas para este paciente.";
    return "No hay citas para este paciente.";
  }

  if (view === RelativeTime.UPCOMING) return "No hay recordatorios próximos para este paciente.";
  if (view === RelativeTime.PAST) return "No hay recordatorios pasados para este paciente.";
  return `No hay ${relation} para este paciente.`;
}

export function PatientDrawer({
  patient: initialPatient,
  onClose,
  onEdit,
  onDelete,
  onViewAppointment,
  onViewReminder,
}: {
  patient: Patient;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onViewAppointment?: (appointment: Appointment) => void;
  onViewReminder?: (reminder: NonNullable<Patient["reminders"]>[number]) => void;
}) {
  const { patient: patientWithRelations, error } = useFetchPatient(initialPatient.id, {
    take: DRAWER_PREVIEW_TAKE,
  });
  const patient = patientWithRelations ?? initialPatient;
  const { locations } = useFetchLocations();
  const { appointmentTypes } = useFetchAppointmentTypes();
  const [appointmentView, setAppointmentView] = useState<RelativeTime>(RelativeTime.ALL);
  const [reminderView, setReminderView] = useState<RelativeTime>(RelativeTime.ALL);
  const appointments = patientWithRelations?.appointments;
  const reminders = patientWithRelations?.reminders;

  const filteredAppointments = useMemo(
    () =>
      (appointments ?? [])
        .filter((apt) => {
          const aptDate = new Date(apt.startAt);
          if (appointmentView === RelativeTime.UPCOMING) return aptDate >= new Date();
          if (appointmentView === RelativeTime.PAST) return aptDate < new Date();
          return true;
        })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [appointments, appointmentView],
  );

  const filteredReminders = useMemo(
    () =>
      (reminders ?? [])
        .filter((rem) => {
          const remDate = new Date(rem.sendAt);
          if (reminderView === RelativeTime.UPCOMING) return remDate >= new Date();
          if (reminderView === RelativeTime.PAST) return remDate < new Date();
          return true;
        })
        .sort((a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime()),
    [reminders, reminderView],
  );

  const locationNameById = useMemo(
    () => Object.fromEntries(locations.map((location) => [location.id, location.name])),
    [locations],
  );
  const appointmentTypeNameById = useMemo(
    () => Object.fromEntries(appointmentTypes.map((type) => [type.id, type.name])),
    [appointmentTypes],
  );

  if (!patient.status) {
    return (
      <DrawerShell
        title="Paciente"
        eyebrow="Perfil del paciente"
        icon={NAV_ICONS.patients}
        onClose={onClose}
        panelTestId="patient-drawer-panel"
        closeTestId="patient-drawer-close-button"
      >
        <DrawerState
          message={error ? "No se pudo cargar el paciente" : "Cargando paciente…"}
          error={Boolean(error)}
        />
      </DrawerShell>
    );
  }

  const footer = (onEdit || onDelete) ? (
    <>
      {onEdit && (
        <button type="button" onClick={onEdit} className="btn-primary btn-primary--block" data-testid="patient-drawer-edit-button">
          <ACTION_ICONS.edit size={16} aria-hidden="true" /> Editar
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className={patient.status === PatientStatus.ACTIVE ? "btn-drawer-delete" : "btn-drawer-activate"}
          data-testid="patient-drawer-delete-button"
          aria-label={patient.status === PatientStatus.ACTIVE ? "Desactivar paciente" : "Reactivar paciente"}
          title={patient.status === PatientStatus.ACTIVE ? "Desactivar paciente" : "Reactivar paciente"}
        >
          {patient.status === PatientStatus.ACTIVE ? (
            <ACTION_ICONS.cancel size={16} aria-hidden="true" />
          ) : (
            <ACTION_ICONS.retry size={16} aria-hidden="true" />
          )}
        </button>
      )}
    </>
  ) : undefined;

  return (
    <DrawerShell
      title={`${patient.name} ${patient.lastName}`}
      eyebrow="Perfil del paciente"
      icon={NAV_ICONS.patients}
      status={<PatientStatusPill status={patient.status} />}
      footer={footer}
      onClose={onClose}
      panelTestId="patient-drawer-panel"
      closeTestId="patient-drawer-close-button"
    >
      <Section title="Información de Contacto">
        {patient.email && <Row icon={DETAIL_ICONS.mail} label="Correo" value={<a href={`mailto:${patient.email}`} className="td-email-link">{patient.email}</a>} />}
        {patient.whatsappNumber && <Row icon={CHANNEL_ICONS.WHATSAPP} label="WhatsApp" testId="patient-drawer-whatsapp" value={<span className="mono">{patient.whatsappNumber}</span>} />}
        {patient.smsNumber && <Row icon={CHANNEL_ICONS.SMS} label="SMS" testId="patient-drawer-sms" value={<span className="mono">{patient.smsNumber}</span>} />}
        {!patient.email && !patient.whatsappNumber && !patient.smsNumber && (
          <div className="drawer-empty" role="status">Sin información de contacto registrada</div>
        )}
      </Section>

      <Section title="Información Adicional">
        {patient.dateOfBirth && <Row icon={DETAIL_ICONS.calendar} label="Fecha de Nacimiento" value={fmtDate(patient.dateOfBirth)} />}
        {patient.notes && (
          <div className="drawer-notes">
            <div className="notes-label">Notas</div>
            <div className="notes-text">{patient.notes}</div>
          </div>
        )}
        {!patient.dateOfBirth && !patient.notes && <div className="drawer-empty">Sin información adicional</div>}
        <Link href={`/medical-records?patientId=${patient.id}`} className="drawer-link">
          <DETAIL_ICONS.history size={15} aria-hidden="true" /> Ver historia clínica
        </Link>
      </Section>

      {appointments && appointments.length > 0 && (
        <Section title="Citas Vinculadas">
          <TabNav
            wrapperClassName="filter-chips"
            items={[
              { key: RelativeTime.UPCOMING, label: "Próximas" },
              { key: RelativeTime.PAST, label: "Pasadas" },
              { key: RelativeTime.ALL, label: "Todas" },
            ]}
            active={appointmentView}
            onSelect={(key) => setAppointmentView(key as RelativeTime)}
          />
          {filteredAppointments.length > 0 ? (
            <>
              <div className="card-list">
                {filteredAppointments.map((apt) => (
                  <LinkedCard
                    key={apt.id}
                    onClick={onViewAppointment ? () => onViewAppointment(apt) : undefined}
                    icon={DETAIL_ICONS.calendar}
                    testId={`patient-drawer-appointment-card-${apt.id}`}
                  >
                    <span className="linked-card__header">
                      <span className="linked-card__copy">
                        <span className="linked-card__title">{appointmentTypeNameById[apt.typeId ?? ""] || "Desconocido"}</span>
                        <span className="linked-card__meta">{fmtDateTime(apt.startAt.toString())}</span>
                      </span>
                      <AppointmentStatusPill status={apt.status} />
                    </span>
                    <span className="linked-card__footer">
                      <span>{locationNameById[apt.locationId ?? ""] || "Desconocida"}</span>
                      {apt.paid && <span>Pagada</span>}
                    </span>
                  </LinkedCard>
                ))}
              </div>
              {filteredAppointments.length === DRAWER_PREVIEW_TAKE && <div className="drawer-caption">Mostrando las {DRAWER_PREVIEW_TAKE} más recientes</div>}
            </>
          ) : (
            <div className="drawer-empty" role="status">{getEmptyRelationMessage("citas", appointmentView)}</div>
          )}
          <Link href={`/appointments?patientId=${patient.id}`} className="drawer-link">
            <DETAIL_ICONS.history size={15} aria-hidden="true" /> Ver todas las citas
          </Link>
        </Section>
      )}

      {reminders && reminders.length > 0 && (
        <Section title="Recordatorios Vinculados">
          <TabNav
            wrapperClassName="filter-chips"
            items={[
              { key: RelativeTime.UPCOMING, label: "Próximos" },
              { key: RelativeTime.PAST, label: "Pasados" },
              { key: RelativeTime.ALL, label: "Todos" },
            ]}
            active={reminderView}
            onSelect={(key) => setReminderView(key as RelativeTime)}
          />
          {filteredReminders.length > 0 ? (
            <>
              <div className="card-list">
                {filteredReminders.map((rem) => (
                  <LinkedCard
                    key={rem.id}
                    onClick={onViewReminder ? () => onViewReminder(rem) : undefined}
                    icon={NAV_ICONS.reminders}
                    testId={`patient-drawer-reminder-card-${rem.id}`}
                  >
                    <span className="linked-card__header">
                      <span className="linked-card__copy">
                        <span className="linked-card__title">{rem.channel === Channel.WHATSAPP ? "WhatsApp" : "SMS"}</span>
                        <span className="linked-card__meta">
                          {rem.sentAt ? `Enviado: ${fmtDateTime(rem.sentAt.toString())}` : `Programado: ${fmtDateTime(rem.sendAt.toString())}`}
                        </span>
                      </span>
                      <ReminderStatusPill status={rem.status} />
                    </span>
                    {rem.error && <span className="linked-card__error">{rem.error}</span>}
                  </LinkedCard>
                ))}
              </div>
              {filteredReminders.length === DRAWER_PREVIEW_TAKE && <div className="drawer-caption">Mostrando los {DRAWER_PREVIEW_TAKE} más recientes</div>}
            </>
          ) : (
            <div className="drawer-empty" role="status">{getEmptyRelationMessage("recordatorios", reminderView)}</div>
          )}
          <Link href={`/reminders?patientId=${patient.id}`} className="drawer-link">
            <DETAIL_ICONS.history size={15} aria-hidden="true" /> Ver todos los recordatorios
          </Link>
        </Section>
      )}

      <Section title="Información del sistema" quiet>
        <Row icon={DETAIL_ICONS.id} label="ID" value={<span className="mono-sm">{patient.id}</span>} />
        <Row icon={DETAIL_ICONS.calendar} label="Creado" value={new Date(patient.createdAt).toLocaleString("es-ES")} />
        <Row icon={DETAIL_ICONS.refresh} label="Actualizado" value={new Date(patient.updatedAt).toLocaleString("es-ES")} />
        <Link href={`/settings?tab=Registro+de+actividad&entityId=${patient.id}`} className="drawer-link">
          <DETAIL_ICONS.history size={15} aria-hidden="true" /> Ver registros de actividad
        </Link>
      </Section>
    </DrawerShell>
  );
}
