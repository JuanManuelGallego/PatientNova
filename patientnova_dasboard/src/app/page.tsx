"use client";

import Link from "next/link";
import Sidebar from "../components/Navigation/Sidebar";
import { StatCard } from "../components/Info/StatCard";
import { AppointmentStatusPill, ReminderStatusPill } from "../components/Info/StatusPill";
import { useFetchPatientsStats } from "../api/useFetchPatientsStats";
import { useFetchAppointmentsStats } from "../api/useFetchAppointmentsStats";
import { useFetchRemindersStats } from "../api/useFetchRemindersStats";
import { useFetchAppointments } from "../api/useFetchAppointments";
import { useFetchReminders } from "../api/useFetchReminders";
import { LOCATION_CFG } from "../types/Appointment";
import { ReminderStatus, CHANNEL_ICON } from "../types/Reminder";
import { PatientStatus } from "../types/Patient";
import { fmtDateAndTime, fmtRelative, today } from "../utils/TimeUtils";
import { getAvatarColor, getInitials } from "../utils/AvatarHelper";
import { useMemo } from "react";

export default function DashboardPage() {
  const { stats: patientStats } = useFetchPatientsStats();
  const { stats: apptStats } = useFetchAppointmentsStats();
  const { stats: reminderStats } = useFetchRemindersStats();

  const todayStr = today();
  const todayFilters = useMemo(() => ({
    dateFrom: `${todayStr}T00:00:00.000Z`,
    dateTo: `${todayStr}T23:59:59.999Z`,
    page: 1,
    pageSize: 5,
    orderBy: "startAt" as const,
    order: "asc" as const,
  }), [ todayStr ]);
  const { appointments: todayAppts, loading: loadingAppts } = useFetchAppointments(todayFilters);

  const reminderFilters = useMemo(() => ({
    status: [ ReminderStatus.PENDING, ReminderStatus.QUEUED ],
    page: 1,
    pageSize: 5,
    orderBy: "sendAt" as const,
    order: "asc" as const,
  }), []);
  const { reminders: activeReminders, loading: loadingReminders } = useFetchReminders(reminderFilters);

  const pendingReminders = (reminderStats?.byStatus[ ReminderStatus.PENDING ] ?? 0) + (reminderStats?.byStatus[ ReminderStatus.QUEUED ] ?? 0);
  const failedReminders = reminderStats?.byStatus[ ReminderStatus.FAILED ] ?? 0;

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="page-main">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Vista General</h1>
            <p className="page-subtitle">
              {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        {/* Welcome banner */}
        <div className="dash-welcome fade-in">
          <div className="dash-welcome__text">
            <span className="dash-welcome__greeting">Buenos días, Dra. Cardona 👋</span>
            <span className="dash-welcome__summary">
              Tienes <strong>{apptStats?.todayCount ?? 0} citas</strong> hoy
              {pendingReminders > 0 && <> y <strong>{pendingReminders} recordatorios</strong> pendientes</>}
              {failedReminders > 0 && <> · <span style={{ color: "var(--c-error)" }}>{failedReminders} fallidos</span></>}
            </span>
          </div>
          <div className="dash-welcome__actions">
            <Link href="/appointments" className="btn-primary btn-hero" style={{ textDecoration: "none" }}>
              <span className="btn-plus-icon">+</span> Nueva Cita
            </Link>
            <Link href="/reminders" className="btn-secondary" style={{ textDecoration: "none" }}>
              🔔 Recordatorios
            </Link>
          </div>
        </div>

        {/* Key metrics */}
        <div className="stats-grid stats-grid--5 fade-in">
          <StatCard label="Citas Hoy" value={apptStats?.todayCount ?? 0} sub="programadas" accent="var(--c-brand-accent)" />
          <StatCard label="Pacientes" value={patientStats?.total ?? 0} sub={`${patientStats?.byStatus[ PatientStatus.ACTIVE ] ?? 0} activos`} accent="var(--c-brand)" />
          <StatCard label="Recordatorios" value={pendingReminders} sub="por enviar" accent="var(--c-link)" />
          <StatCard label="Sin Pagar" value={apptStats?.unpaidCount ?? 0} sub={`$ ${(apptStats?.unpaidRevenue ?? 0).toLocaleString("es-ES")}`} accent="var(--c-error)" />
          <StatCard label="Ingresos" value={`$ ${(apptStats?.paidRevenue ?? 0).toLocaleString("es-ES")}`} sub="total cobrado" accent="var(--c-success)" />
        </div>

        {/* Two-column layout: Today's appointments + Active reminders */}
        <div className="dash-grid fade-in">
          {/* Today's appointments */}
          <div className="dash-card">
            <div className="dash-card__header">
              <div>
                <h2 className="dash-card__title">📝 Citas de Hoy</h2>
                <p className="dash-card__sub">{apptStats?.todayCount ?? 0} citas programadas</p>
              </div>
              <Link href="/appointments" className="dash-card__link">Ver todas →</Link>
            </div>
            <div className="dash-card__body">
              {loadingAppts ? (
                <div className="dash-skeleton-list">
                  {[ 1, 2, 3 ].map(i => <div key={i} className="dash-skeleton-row"><div className="skeleton-bar" style={{ width: "100%" }} /></div>)}
                </div>
              ) : todayAppts.length === 0 ? (
                <div className="dash-empty">
                  <span className="dash-empty__icon">🗓️</span>
                  <span className="dash-empty__text">No hay citas para hoy</span>
                </div>
              ) : (
                <div className="dash-list">
                  {todayAppts.map(a => (
                    <Link key={a.id} href="/appointments" className="dash-list-item" style={{ textDecoration: "none", color: "inherit" }}>
                      <div className="dash-list-item__left">
                        <div className="avatar avatar--sm" style={{ background: getAvatarColor(a.patient.id) }}>
                          {getInitials(a.patient.name, a.patient.lastName)}
                        </div>
                        <div>
                          <div className="dash-list-item__name">{a.patient.name} {a.patient.lastName}</div>
                          <div className="dash-list-item__meta">{a.type} · {fmtDateAndTime(a.startAt)}</div>
                        </div>
                      </div>
                      <div className="dash-list-item__right">
                        <div className="location-badge" style={{ background: LOCATION_CFG[ a.location ]?.bg || "var(--c-gray-100)", color: LOCATION_CFG[ a.location ]?.color || "var(--c-gray-700)", fontSize: 11 }}>
                          {a.location}
                        </div>
                        <AppointmentStatusPill status={a.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active reminders */}
          <div className="dash-card">
            <div className="dash-card__header">
              <div>
                <h2 className="dash-card__title">🔔 Recordatorios Activos</h2>
                <p className="dash-card__sub">{pendingReminders} pendientes</p>
              </div>
              <Link href="/reminders" className="dash-card__link">Ver todos →</Link>
            </div>
            <div className="dash-card__body">
              {loadingReminders ? (
                <div className="dash-skeleton-list">
                  {[ 1, 2, 3 ].map(i => <div key={i} className="dash-skeleton-row"><div className="skeleton-bar" style={{ width: "100%" }} /></div>)}
                </div>
              ) : activeReminders.length === 0 ? (
                <div className="dash-empty">
                  <span className="dash-empty__icon">✅</span>
                  <span className="dash-empty__text">No hay recordatorios pendientes</span>
                </div>
              ) : (
                <div className="dash-list">
                  {activeReminders.map(r => (
                    <Link key={r.id} href="/reminders" className="dash-list-item" style={{ textDecoration: "none", color: "inherit" }}>
                      <div className="dash-list-item__left">
                        <span className="dash-channel-icon">{CHANNEL_ICON[ r.channel ]}</span>
                        <div>
                          <div className="dash-list-item__name">{r.patient?.name ?? "—"} {r.patient?.lastName ?? ""}</div>
                          <div className="dash-list-item__meta">{r.to} · {fmtRelative(r.sendAt)}</div>
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
        </div>

        {/* Quick nav cards */}
        <div className="dash-quick-nav fade-in">
          <h3 className="dash-section-title">Acceso Rápido</h3>
          <div className="dash-nav-grid">
            {[
              { href: "/patients", icon: "🪪", label: "Pacientes", desc: `${patientStats?.total ?? 0} registrados`, accent: "var(--c-brand)" },
              { href: "/appointments", icon: "📝", label: "Citas", desc: `${apptStats?.total ?? 0} en total`, accent: "var(--c-brand-accent)" },
              { href: "/calendar", icon: "📆", label: "Calendario", desc: "Vista mensual", accent: "var(--c-success)" },
              { href: "/reminders", icon: "🔔", label: "Recordatorios", desc: `${reminderStats?.total ?? 0} creados`, accent: "var(--c-link)" },
              { href: "/templates", icon: "📄", label: "Plantillas", desc: "Mensajes predefinidos", accent: "var(--c-warning)" },
              { href: "/settings", icon: "⚙️", label: "Configuración", desc: "Preferencias", accent: "var(--c-gray-500)" },
            ].map(item => (
              <Link key={item.href} href={item.href} className="dash-nav-card" style={{ textDecoration: "none", borderLeft: `4px solid ${item.accent}` }}>
                <span className="dash-nav-card__icon">{item.icon}</span>
                <div>
                  <div className="dash-nav-card__label">{item.label}</div>
                  <div className="dash-nav-card__desc">{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
