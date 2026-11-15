"use client";
import Link from "next/link";

import { useMemo, useState } from "react";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { useFetchAppointmentsStats } from "@/src/api/appointments/useFetchAppointmentsStats";
import { useFetchAppointments } from "@/src/api/appointments/useFetchAppointments";
import { useFetchRemindersStats } from "@/src/api/reminders/useFetchRemindersStats";
import { useFetchPatientsStats } from "@/src/api/patients/useFetchPatientsStats";
import { useFetchReminders } from "@/src/api/reminders/useFetchReminders";
import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { StatCard } from "@/src/components/Info/StatCard";
import { PendingRequestsCard } from "@/src/components/Dashboard/PendingRequestsCard";
import { PatientStatus } from "@/src/types/Patient";
import { getInitials, getAvatarColor } from "@/src/utils/AvatarHelper";
import { fmtDateTime, fmtRelative, todayFormattedString, todayString, zonedDateTimeParts } from "@/src/utils/TimeUtils";
import {
  AppointmentStatusPill,
  ReminderStatusPill,
} from "@/src/components/Info/StatusPill";
import { useAuthContext } from "@/src/providers/AuthContext";
import {
  Users,
  FileText,
  CalendarDays,
  Bell,
  ClipboardList,
  Settings,
  CalendarCheck,
  CheckCircle,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { CHANNEL_ICONS, DETAIL_ICONS } from "@/src/config/icons";
import { PatientModal } from "@/src/components/Modals/PatientModal";
import { CHANNEL_CFG, ReminderStatus } from "@/src/types/Reminder";
import { toUtcRangeFromLocalDay } from "@/src/components/Calendar/constants";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { settingsHref } from "@/src/config/navigation";
import { fmtMoney } from "@/src/utils/money";

export default function DashboardPage() {
  const timezone = useDisplayTimezone();
  const { stats: patientStats, loading: loadingPatientStats } =
    useFetchPatientsStats();
  const { stats: apptStats, loading: loadingApptStats } =
    useFetchAppointmentsStats();
  const { stats: reminderStats, loading: loadingReminderStats } =
    useFetchRemindersStats();
  const { user } = useAuthContext();

  const [ showApptModal, setShowApptModal ] = useState(false);
  const [ showPatientModal, setShowPatientModal ] = useState(false);

  const todayFilters = useMemo(() => {
    const { dateFrom, dateTo } = toUtcRangeFromLocalDay(todayFormattedString(timezone), timezone);
    return {
      dateFrom,
      dateTo,
      page: 1,
      pageSize: 5,
      orderBy: "startAt" as const,
      order: "asc" as const,
    };
  }, [ timezone ]);
  const { appointments: todayAppts, loading: loadingAppts } =
    useFetchAppointments(todayFilters);

  const reminderFilters = useMemo(
    () => ({
      status: [ ReminderStatus.PENDING, ReminderStatus.QUEUED ],
      page: 1,
      pageSize: 5,
      orderBy: "sendAt" as const,
      order: "asc" as const,
    }),
    [],
  );
  const { reminders: activeReminders, loading: loadingReminders } =
    useFetchReminders(reminderFilters);

  const statsLoading =
    loadingPatientStats || loadingApptStats || loadingReminderStats;
  const pendingReminders = reminderStats
    ? (reminderStats.byStatus[ ReminderStatus.PENDING ] ?? 0) +
      (reminderStats.byStatus[ ReminderStatus.QUEUED ] ?? 0)
    : undefined;

  return (
    <PageLayout>
      <PageHeader title="Vista general" subtitle={todayString(timezone)} />
      <div className="dash-welcome fade-in">
        <div className="dash-welcome__text">
          <span className="dash-welcome__greeting">
            {(() => {
              const h = zonedDateTimeParts(new Date(), timezone).hour;
              return h < 12
                ? "Buenos días"
                : h < 19
                  ? "Buenas tardes"
                  : "Buenas noches";
            })()}
            , {user?.displayName}{" "}
          </span>
        </div>
        <div className="dash-welcome__actions">
          <button
            className="btn-primary btn-hero"
            onClick={() => setShowApptModal(true)}
            data-testid="dashboard-new-appointment-button"
          >
            Nueva cita
          </button>
          <button
            className="btn-primary btn-hero"
            onClick={() => setShowPatientModal(true)}
            data-testid="dashboard-new-patient-button"
          >
            Nuevo paciente
          </button>
        </div>
      </div>
      <div className="stats-grid fade-in">
        {statsLoading ? (
          [ 1, 2, 3, 4, 5 ].map((i) => (
            <div key={i} className="stat-card" style={{ minHeight: 90 }}>
              <div className="stat-card__inner">
                <div className="dash-skeleton-row">
                  <div className="skeleton-bar" style={{ width: "60%" }} />
                </div>
                <div className="dash-skeleton-row">
                  <div className="skeleton-bar" style={{ width: "40%" }} />
                </div>
              </div>
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Citas hoy"
              value={apptStats?.todayCount}
              sub="programadas"
              accent="var(--c-brand-accent)"
              icon={CalendarCheck}
            />
            <StatCard
              label="Pacientes"
              value={patientStats?.total}
              sub={patientStats ? `${patientStats.byStatus[ PatientStatus.ACTIVE ] ?? 0} activos` : "—"}
              accent="var(--c-brand)"
              icon={Users}
            />
            <StatCard
              label="Recordatorios"
              value={pendingReminders}
              sub="pendientes este mes"
              accent="var(--c-link)"
              icon={Bell}
            />
            <StatCard
              label="Sin pagar"
              value={apptStats?.unpaidCount}
              sub={apptStats ? fmtMoney(apptStats.unpaidRevenue) : "—"}
              accent="var(--c-error)"
              icon={AlertCircle}
            />
            <StatCard
              label="Ingresos"
              value={apptStats ? fmtMoney(apptStats.paidRevenue) : undefined}
              sub="total histórico cobrado"
              accent="var(--c-success)"
              icon={DollarSign}
            />
          </>
        )}
      </div>
      <div className="dash-grid fade-in">
        <div className="dash-card">
          <div className="dash-card__header">
            <div>
              <h2 className="dash-card__title">Citas de hoy</h2>
              <p className="dash-card__sub">
                {apptStats ? apptStats.todayCount : "—"} citas programadas
              </p>
            </div>
            <Link href="/appointments" className="dash-card__link">
              Ver todas →
            </Link>
          </div>
          <div className="dash-card__body">
            {loadingAppts ? (
              <div className="dash-skeleton-list">
                {[ 1, 2, 3 ].map((i) => (
                  <div key={i} className="dash-skeleton-row">
                    <div className="skeleton-bar" style={{ width: "100%" }} />
                  </div>
                ))}
              </div>
            ) : todayAppts.length === 0 ? (
              <div className="dash-empty">
                <span
                  className="dash-empty__icon"
                  role="img"
                  aria-label="calendario"
                >
                  <CalendarCheck size={24} />
                </span>
                <span className="dash-empty__text">No hay citas para hoy</span>
              </div>
            ) : (
              <div className="dash-list">
                {todayAppts.map((a) => (
                  <Link
                    key={a.id}
                    href="/appointments"
                    className="dash-list-item dash-list-item-link"
                  >
                    <div className="dash-list-item__left">
                      <div
                        className="avatar avatar--sm"
                        style={{ background: getAvatarColor(a.patient.id) }}
                      >
                        {getInitials(a.patient.name, a.patient.lastName)}
                      </div>
                      <div>
                        <div className="dash-list-item__name">
                          {a.patient.name} {a.patient.lastName}
                        </div>
                        <div className="dash-list-item__meta">
                          {a.appointmentType?.name} · {fmtDateTime(a.startAt, timezone)}
                        </div>
                      </div>
                    </div>
                    <div className="dash-list-item__right">
                      <div
                        className="location-label"
                      >
                        <DETAIL_ICONS.mapPin
                          size={13}
                          style={{ color: a.appointmentLocation.color || "var(--c-gray-400)" }}
                          aria-hidden="true"
                        />
                        {a.appointmentLocation.name}
                      </div>
                      <AppointmentStatusPill status={a.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card__header">
            <div>
              <h2 className="dash-card__title">Recordatorios activos</h2>
              <p className="dash-card__sub">{pendingReminders ?? "—"} pendientes este mes</p>
            </div>
            <Link href="/reminders" className="dash-card__link">
              Ver todos →
            </Link>
          </div>
          <div className="dash-card__body">
            {loadingReminders ? (
              <div className="dash-skeleton-list">
                {[ 1, 2, 3 ].map((i) => (
                  <div key={i} className="dash-skeleton-row">
                    <div className="skeleton-bar" style={{ width: "100%" }} />
                  </div>
                ))}
              </div>
            ) : activeReminders.length === 0 ? (
              <div className="dash-empty">
                <span
                  className="dash-empty__icon"
                  role="img"
                  aria-label="completado"
                >
                  <CheckCircle size={24} />
                </span>
                <span className="dash-empty__text">
                  No hay recordatorios pendientes
                </span>
              </div>
            ) : (
              <div className="dash-list">
                {activeReminders.map((r) => (
                  <Link
                    key={r.id}
                    href="/reminders"
                    className="dash-list-item dash-list-item-link"
                  >
                    <div className="dash-list-item__left">
                      <span
                        className="dash-channel-icon"
                        role="img"
                        aria-label={CHANNEL_CFG[ r.channel ].label}
                      >
                        {(() => {
                          const CI = CHANNEL_ICONS[ r.channel ];
                          return <CI size={16} />;
                        })()}
                      </span>
                      <div>
                        <div className="dash-list-item__name">
                          {r.patient?.name ?? "—"} {r.patient?.lastName ?? ""}
                        </div>
                        <div className="dash-list-item__meta">
                          {r.to} · {fmtRelative(r.sendAt)}
                        </div>
                      </div>
                    </div>
                    <div className="dash-list-item__right">
                      <ReminderStatusPill status={r.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <PendingRequestsCard />
      </div>
      <div className="dash-quick-nav fade-in">
        <h3 className="dash-section-title">Acceso rápido</h3>
        <div className="dash-nav-grid">
          {[
            {
              href: "/patients",
              Icon: Users,
              label: "Pacientes",
              desc: `${patientStats ? patientStats.total : "—"} registrados`,
              accent: "var(--c-brand)",
            },
            {
              href: "/appointments",
              Icon: FileText,
              label: "Citas",
              desc: `${apptStats ? apptStats.total : "—"} en total`,
              accent: "var(--c-brand-accent)",
            },
            {
              href: "/calendar",
              Icon: CalendarDays,
              label: "Calendario",
              desc: "Vista mensual",
              accent: "var(--c-success)",
            },
            {
              href: "/reminders",
              Icon: Bell,
              label: "Recordatorios",
              desc: `${reminderStats ? reminderStats.total : "—"} programados este mes`,
              accent: "var(--c-link)",
            },
            {
              href: "/medical-records",
              Icon: ClipboardList,
              label: "Historias clínicas",
              desc: "Historial médico completo",
              accent: "var(--c-warning)",
            },
            {
              href: settingsHref("account"),
              Icon: Settings,
              label: "Configuración",
              desc: "Preferencias",
              accent: "var(--c-gray-500)",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="dash-nav-card dash-list-item-link"
            >
              <span
                className="card-icon-tile dash-nav-card__icon"
                style={{ color: item.accent }}
                role="img"
                aria-label={item.label}
              >
                <item.Icon size={22} />
              </span>
              <div>
                <div className="dash-nav-card__label">{item.label}</div>
                <div className="dash-nav-card__desc">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {showApptModal && (
        <AppointmentModal
          onClose={() => setShowApptModal(false)}
          onSaved={() => setShowApptModal(false)}
        />
      )}
      {showPatientModal && (
        <PatientModal
          onClose={() => setShowPatientModal(false)}
          onSaved={() => setShowPatientModal(false)}
        />
      )}
    </PageLayout>
  );
}
