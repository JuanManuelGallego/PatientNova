import { APPT_STATUS_CFG, Appointment } from "@/src/types/Appointment";
import { Patient, PATIENT_STATUS_CONFIG, PatientStatus } from "@/src/types/Patient";
import { Channel, REMINDER_STATUS_CONFIG } from "@/src/types/Reminder";
import { fmtDate, fmtDateTime, RelativeTime } from "@/src/utils/TimeUtils";
import {
  PatientStatusPill,
  AppointmentStatusPill,
  ReminderStatusPill,
} from "../Info/StatusPill";
import { LinkedCard, Section, Row } from "./DrawerUtils";
import { useFetchLocations } from "@/src/api/locations/useFetchLocations";
import { useFetchAppointmentTypes } from "@/src/api/appointment-types/useFetchAppointmentTypes";
import { useState, useMemo } from "react";
import Link from "next/link";
import { TabNav } from "@/src/components/TabNav";
import { useFetchPatient } from "@/src/api/patients/useFetchPatient";
import { ACTION_ICONS, DETAIL_ICONS, CHANNEL_ICONS } from "@/src/config/icons";

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

  const [ appointmentView, setAppointmentView ] = useState<RelativeTime>(
    RelativeTime.ALL,
  );
  const [ reminderView, setReminderView ] = useState<RelativeTime>(
    RelativeTime.ALL,
  );
  const appointments = patientWithRelations?.appointments;
  const reminders = patientWithRelations?.reminders;

  const filteredAppointments = useMemo(
    () =>
      (appointments ?? [])
        .filter((apt) => {
          const now = new Date();
          const aptDate = new Date(apt.startAt);
          if (appointmentView === RelativeTime.UPCOMING) return aptDate >= now;
          if (appointmentView === RelativeTime.PAST) return aptDate < now;
          return true;
        })
        .sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        ),
    [ appointments, appointmentView ],
  );

  const filteredReminders = useMemo(
    () =>
      (reminders ?? [])
        .filter((rem) => {
          const now = new Date();
          const remDate = new Date(rem.sendAt);
          if (reminderView === RelativeTime.UPCOMING) return remDate >= now;
          if (reminderView === RelativeTime.PAST) return remDate < now;
          return true;
        })
        .sort(
          (a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime(),
        ),
    [ reminders, reminderView ],
  );

  const locationNameById = useMemo(
    () => locations.reduce(
      (acc, loc) => ({ ...acc, [ loc.id ]: loc.name }),
      {} as Record<string, string>,
    ),
    [ locations ],
  );
  const appointmentTypeNameById = useMemo(
    () => appointmentTypes.reduce(
      (acc, at) => ({ ...acc, [ at.id ]: at.name }),
      {} as Record<string, string>,
    ),
    [ appointmentTypes ],
  );

  if (!patient.status) {
    return (
      <div className="drawer-overlay" onClick={onClose}>
        <div className="drawer-backdrop" />
        <div className="drawer-panel" onClick={(e) => e.stopPropagation()} data-testid="patient-drawer-panel">
          <div className="drawer-header">
            <div className="drawer-header__top">
              <h2 className="drawer-header__title">Paciente</h2>
              <button onClick={onClose} className="btn-close--transparent" data-testid="patient-drawer-close-button">
                <ACTION_ICONS.close size={16} />
              </button>
            </div>
          </div>
          <div className="drawer-body">
            <div className="text-muted">{error ? "No se pudo cargar el paciente" : "Cargando paciente..."}</div>
          </div>
        </div>
      </div>
    );
  }

  const s = PATIENT_STATUS_CONFIG[ patient.status ];

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-backdrop" />
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()} data-testid="patient-drawer-panel">
        <div
          className="drawer-header"
          style={{ background: s.bg, borderBottom: `3px solid ${s.color}` }}
        >
          <div className="drawer-header__top">
            <div>
              <h2 className="drawer-header__title">
                {patient.name} {patient.lastName}
              </h2>
              <div className="drawer-header__status">
                <PatientStatusPill status={patient.status} />
              </div>
            </div>
            <button onClick={onClose} className="btn-close--transparent" data-testid="patient-drawer-close-button">
              <ACTION_ICONS.close size={16} />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <Section title="Información de Contacto">
            {patient.email && (
              <Row
                icon={DETAIL_ICONS.mail}
                label="Correo"
                value={
                  <a href={`mailto:${patient.email}`} className="td-email-link">
                    {patient.email}
                  </a>
                }
              />
            )}
            {patient.whatsappNumber && (
              <Row
                icon={CHANNEL_ICONS.WHATSAPP}
                label="WhatsApp"
                testId="patient-drawer-whatsapp"
                value={<span className="mono">{patient.whatsappNumber}</span>}
              />
            )}
            {patient.smsNumber && (
              <Row
                icon={CHANNEL_ICONS.SMS}
                label="SMS"
                testId="patient-drawer-sms"
                value={<span className="mono">{patient.smsNumber}</span>}
              />
            )}
            {!patient.email &&
              !patient.whatsappNumber &&
              !patient.smsNumber && (
                <div className="text-muted">
                  Sin información de contacto registrada
                </div>
              )}
          </Section>
          <Section title="Información Adicional">
            {patient.dateOfBirth && (
              <Row
                icon={DETAIL_ICONS.calendar}
                label="Fecha de Nacimiento"
                value={fmtDate(patient.dateOfBirth)}
              />
            )}
            {patient.notes && (
              <div className="detail-row">
                <div className="detail-row__content">
                  <div className="notes-label">Notas</div>
                  <div className="notes-text">{patient.notes}</div>
                </div>
              </div>
            )}
            {!patient.dateOfBirth && !patient.notes && (
              <div className="text-muted">Sin información adicional</div>
            )}
            <Link
              href={`/medical-records?patientId=${patient.id}`}
              className="btn-secondary btn-primary--block"
              style={{ marginTop: 12, textDecoration: "none" }}
            >
              <DETAIL_ICONS.history size={14} /> Ver historia clínica
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
                    {filteredAppointments.map((apt) => {
                      const aptStatus = APPT_STATUS_CFG[ apt.status ];
                      return (
                        <LinkedCard
                          key={apt.id}
                          onClick={onViewAppointment ? () => onViewAppointment(apt) : undefined}
                          style={{ borderLeft: `3px solid ${aptStatus.dot}` }}
                          testId={`patient-drawer-appointment-card-${apt.id}`}
                        >
                          <div className="linked-card__header">
                            <div>
                              <div className="linked-card__title">
                                {appointmentTypeNameById[ apt.typeId ?? "" ] ||
                                  "Desconocido"}
                              </div>
                              <div className="linked-card__meta">
                                {fmtDateTime(apt.startAt.toString())}
                              </div>
                            </div>
                            <AppointmentStatusPill status={apt.status} />
                          </div>
                          <div className="linked-card__footer">
                            <span>
                              {locationNameById[ apt.locationId ?? "" ] ||
                                "Desconocida"}
                            </span>
                            {apt.paid && <span>Pagada</span>}
                          </div>
                        </LinkedCard>
                      );
                    })}
                  </div>
                  {filteredAppointments.length === DRAWER_PREVIEW_TAKE && (
                    <div className="text-muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Mostrando las {DRAWER_PREVIEW_TAKE} más recientes
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted" role="status">
                  {getEmptyRelationMessage("citas", appointmentView)}
                </div>
              )}
              <Link
                href={`/appointments?patientId=${patient.id}`}
                className="btn-secondary btn-primary--block"
                style={{ marginTop: 12, textDecoration: "none" }}
              >
                <DETAIL_ICONS.history size={14} /> Ver todas las citas
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
                    {filteredReminders.map((rem) => {
                      const remStatus = REMINDER_STATUS_CONFIG[ rem.status ];
                      const channelLabel =
                        rem.channel === Channel.WHATSAPP ? "WhatsApp" : "SMS";
                      return (
                        <LinkedCard
                          key={rem.id}
                          onClick={onViewReminder ? () => onViewReminder(rem) : undefined}
                          style={{ borderLeft: `3px solid ${remStatus.dot}` }}
                          testId={`patient-drawer-reminder-card-${rem.id}`}
                        >
                          <div className="linked-card__header">
                            <div>
                              <div className="linked-card__title">
                                {channelLabel}
                              </div>
                              <div className="linked-card__meta linked-card__meta">
                                {rem.sentAt
                                  ? `Enviado: ${fmtDateTime(rem.sentAt.toString())}`
                                  : `Programado: ${fmtDateTime(rem.sendAt.toString())}`}
                              </div>
                            </div>
                            <ReminderStatusPill status={rem.status} />
                          </div>
                          {rem.error && (
                            <div className="linked-card__error">{rem.error}</div>
                          )}
                        </LinkedCard>
                      );
                    })}
                  </div>
                  {filteredReminders.length === DRAWER_PREVIEW_TAKE && (
                    <div className="text-muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Mostrando los {DRAWER_PREVIEW_TAKE} más recientes
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted" role="status">
                  {getEmptyRelationMessage("recordatorios", reminderView)}
                </div>
              )}
              <Link
                href={`/reminders?patientId=${patient.id}`}
                className="btn-secondary btn-primary--block"
                style={{ marginTop: 12, textDecoration: "none" }}
              >
                <DETAIL_ICONS.history size={14} /> Ver todos los recordatorios
              </Link>
            </Section>
          )}
          <Section title="Información del sistema">
            <Row
              icon={DETAIL_ICONS.id}
              label="ID"
              value={<span className="mono-sm">{patient.id}</span>}
            />
            <Row
              icon={DETAIL_ICONS.calendar}
              label="Creado"
              value={new Date(patient.createdAt).toLocaleString("es-ES")}
            />
            <Row
              icon={DETAIL_ICONS.refresh}
              label="Actualizado"
              value={new Date(patient.updatedAt).toLocaleString("es-ES")}
            />
            <Link
              href={`/settings?tab=Registro+de+actividad&entityId=${patient.id}`}
              className="btn-secondary btn-primary--block"
              style={{ marginTop: 12, textDecoration: "none" }}
            >
              <DETAIL_ICONS.history size={14} /> Ver registros de actividad
            </Link>
          </Section>
        </div>
        {(onEdit || onDelete) && (
          <div className="drawer-footer">
            {onEdit && (
              <button onClick={onEdit} className="btn-primary btn-primary--block" data-testid="patient-drawer-edit-button">
                <ACTION_ICONS.edit size={14} /> Editar
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className={patient.status === PatientStatus.ACTIVE ? "btn-drawer-delete" : "btn-drawer-activate"}
                data-testid="patient-drawer-delete-button"
                title={patient.status === PatientStatus.ACTIVE ? "Desactivar paciente" : "Reactivar paciente"}
              >
                {patient.status === PatientStatus.ACTIVE ? (
                   <ACTION_ICONS.cancel size={14} />
                ) : (
                  <ACTION_ICONS.retry size={14} />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
