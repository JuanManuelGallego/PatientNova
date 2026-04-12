"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import { AppointmentModal } from '@/src/components/Modals/AppointmentModal';
import { useFetchRemindersStats } from '@/src/api/useFetchRemindersStats';
import { useFetchAppointmentsStats } from '@/src/api/useFetchAppointmentsStats';
import { useFetchPatientsStats } from '@/src/api/useFetchPatientsStats';
import { useFetchAppointments } from '@/src/api/useFetchAppointments';
import { ReminderStatus, CHANNEL_CFG } from '@/src/types/Reminder';
import { useFetchReminders } from '@/src/api/useFetchReminders';
import PageLayout from '@/src/components/PageLayout';
import { PageHeader } from '@/src/components/PageHeader';
import { StatCard } from '@/src/components/Info/StatCard';
import { PatientStatus } from '@/src/types/Patient';
import { getInitials, getAvatarColor } from '@/src/utils/AvatarHelper';
import { fmtDateAndTime, fmtRelative } from '@/src/utils/TimeUtils';
import { AppointmentStatusPill, ReminderStatusPill } from '@/src/components/Info/StatusPill';
import { useAuthContext } from "../AuthContext";
import { ReminderModal } from "@/src/components/Modals/ReminderModal";

export default function DashboardPage() {
    const { stats: patientStats } = useFetchPatientsStats();
    const { stats: apptStats } = useFetchAppointmentsStats();
    const { stats: reminderStats } = useFetchRemindersStats();
    const { user } = useAuthContext();

    const [ showApptModal, setShowApptModal ] = useState(false);
    const [ showReminderModal, setShowReminderModal ] = useState(false);

    const todayFilters = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return {
            dateFrom: start.toISOString(),
            dateTo: end.toISOString(),
            page: 1,
            pageSize: 5,
            orderBy: "startAt" as const,
            order: "asc" as const,
        };
    }, []);
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
        <PageLayout>
            <PageHeader
                title="Vista General"
                subtitle={new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            />
            <div className="dash-welcome fade-in">
                <div className="dash-welcome__text">
                    <span className="dash-welcome__greeting">Buenos días, {user?.displayName} </span>
                    <span className="dash-welcome__summary">
                        {failedReminders > 0 && <> · <span style={{ color: "var(--c-error)" }}>{failedReminders} fallidos</span></>}
                    </span>
                </div>
                <div className="dash-welcome__actions">
                    <button className="btn-primary btn-hero" onClick={() => setShowApptModal(true)}>
                        <span className="btn-plus-icon">+</span> Nueva Cita 📝
                    </button>
                    <button className="btn-primary btn-hero" onClick={() => setShowReminderModal(true)}>
                        <span className="btn-plus-icon">+</span> Nuevo Recordatorio 🔔
                    </button>
                </div>
            </div>
            <div className="stats-grid stats-grid--5 fade-in">
                <StatCard label="Citas Hoy" value={apptStats?.todayCount ?? 0} sub="programadas" accent="var(--c-brand-accent)" />
                <StatCard label="Pacientes" value={patientStats?.total ?? 0} sub={`${patientStats?.byStatus[ PatientStatus.ACTIVE ] ?? 0} activos`} accent="var(--c-brand)" />
                <StatCard label="Recordatorios" value={pendingReminders} sub="por enviar" accent="var(--c-link)" />
                <StatCard label="Sin Pagar" value={apptStats?.unpaidCount ?? 0} sub={`$ ${(apptStats?.unpaidRevenue ?? 0).toLocaleString("es-ES")}`} accent="var(--c-error)" />
                <StatCard label="Ingresos" value={`$ ${(apptStats?.paidRevenue ?? 0).toLocaleString("es-ES")}`} sub="total cobrado" accent="var(--c-success)" />
            </div>
            <div className="dash-grid fade-in">
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
                                                <div className="dash-list-item__meta">{a.appointmentType?.name} · {fmtDateAndTime(a.startAt)}</div>
                                            </div>
                                        </div>
                                        <div className="dash-list-item__right">
                                            <div className="location-badge" style={{ background: a.appointmentLocation.bg || "var(--c-gray-100)", color: a.appointmentLocation.color || "var(--c-gray-700)", fontSize: 11 }}>
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
                                            <span className="dash-channel-icon">{CHANNEL_CFG[ r.channel ].icon}</span>
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
            {showApptModal && (
                <AppointmentModal
                    onClose={() => setShowApptModal(false)}
                    onSaved={() => setShowApptModal(false)}
                />
            )}
            {showReminderModal && (
                <ReminderModal
                    onClose={() => setShowReminderModal(false)}
                    onSaved={() => setShowReminderModal(false)}
                />
            )}
        </PageLayout>
    );
}
