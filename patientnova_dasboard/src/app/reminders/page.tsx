"use client";;
import { useMemo, useState, Suspense } from "react";
import { FetchRemindersFilters, Reminder, ReminderStatus } from '@/src/types/Reminder';
import { fmtDateAndTime, fmtRelative } from '@/src/utils/TimeUtils';
import { StatCard } from '@/src/components/Info/StatCard';
import { ChannelBadge } from '@/src/components/Info/ChannelIcon';
import { ReminderModal } from '@/src/components/Modals/ReminderModal';
import { EditScheduledReminderModal } from '@/src/components/Modals/EditScheduledReminderModal';
import { ReminderDrawer } from '@/src/components/Drawers/ReminderDrawer';
import { BulkSendWizard } from '@/src/components/Navigation/BulkSendWizard';
import { EmptyState } from '@/src/components/EmptyState';
import { DataTable, TableFooter } from '@/src/components/DataTable';
import { CancelReminderModal } from '@/src/components/Modals/CancelReminderModal';
import { useFetchReminders } from '@/src/api/useFetchReminders';
import { useFetchPatients } from '@/src/api/useFetchPatients';
import { ErrorBanner } from '@/src/components/Info/ErrorBanner';
import { ReminderStatusPill } from '@/src/components/Info/StatusPill';
import Sidebar from "@/src/components/Navigation/Sidebar";
import { useFetchRemindersStats } from "@/src/api/useFetchRemindersStats";
import { useDebounceState } from "@/src/utils/useDebounceState";
import { useQueryState, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs';

enum ActiveTab { Active = "Active", History = "History", Bulk = "Bulk" }
const PAGE_SIZE = 10;

function RemindersPageContent() {
    const { patients } = useFetchPatients();
    const { stats, fetchStats } = useFetchRemindersStats();

    const [ activeTab, setActiveTab ] = useQueryState("activeTab", parseAsStringEnum(Object.values(ActiveTab)).withDefault(ActiveTab.Active));
    const [ page, setPage ] = useQueryState("page", parseAsInteger.withDefault(1));
    const [ search, setSearch ] = useQueryState("search", parseAsString.withDefault(""));
    const debouncedSearch = useDebounceState(search, 250);

    const [ showCreate, setShowCreate ] = useState(false);
    const [ editReminder, setEditReminder ] = useState<Reminder | null>(null);

    const [ viewReminder, setViewReminder ] = useState<Reminder | null>(null);
    const [ cancelReminder, setCancelReminder ] = useState<Reminder | null>(null);

    const filters = useMemo<FetchRemindersFilters>(() => ({
        status: activeTab === "Active" ? [ ReminderStatus.PENDING, ReminderStatus.QUEUED ] : activeTab === "History" ? [ ReminderStatus.SENT, ReminderStatus.FAILED, ReminderStatus.CANCELLED ] : undefined,
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        orderBy: activeTab === "Active" ? "sendAt" : "updatedAt",
        order: activeTab === "Active" ? "asc" : "desc",
    }), [ page, debouncedSearch, activeTab ]);

    const { reminders, loading, error, fetchReminders, total, totalPages } = useFetchReminders(filters);

    return (
        <>
            <div className="page-shell">
                <Sidebar />
                <main className="page-main">
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Recordatorios</h1>
                            <p className="page-subtitle">
                                {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                            </p>
                        </div>
                        <div className="page-header__actions">
                            <button onClick={() => setShowCreate(true)} className="btn-primary btn-hero">
                                <span className="btn-plus-icon">+</span> Nuevo Recordatorio
                            </button>
                        </div>
                    </div>
                    <div className="stats-grid">
                        <StatCard label="Activos" value={(stats?.byStatus[ ReminderStatus.PENDING ] || 0) + (stats?.byStatus[ ReminderStatus.QUEUED ] || 0)} sub="por enviar" accent="var(--c-link)" />
                        <StatCard label="Enviados" value={stats?.byStatus[ ReminderStatus.SENT ] || 0} sub="entregados" accent="var(--c-success)" />
                        <StatCard label="Fallidos" value={stats?.byStatus[ ReminderStatus.FAILED ] || 0} sub="requieren atención" accent="var(--c-error)" />
                        <StatCard label="Cancelados" value={stats?.byStatus[ ReminderStatus.CANCELLED ] || 0} sub="fuera de la cola" accent="var(--c-gray-400)" />
                    </div>
                    <ReminderTabs activeTab={activeTab} setActiveTab={setActiveTab} stats={stats} />
                    {activeTab !== "Bulk" && (
                        <div className="filter-bar">
                            <div className="search-wrapper">

                                <input
                                    placeholder="Buscar por nombre, número, canal…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="form-input"
                                />
                                <button
                                    onClick={() => { setSearch(""); setPage(1); }}
                                    className="search-clear-btn"
                                    aria-label="Limpiar búsqueda"
                                >✕</button>
                            </div>
                        </div>
                    )}
                    {error && activeTab !== "Bulk" && <ErrorBanner msg={error} onRetry={() => { fetchReminders(); fetchStats(); }} />}
                    {activeTab === "Active" && (
                        <ActiveRemindersTab
                            reminders={reminders} loading={loading}
                            page={page} total={total} totalPages={totalPages} setPage={setPage}
                            setViewReminder={setViewReminder} setEditReminder={setEditReminder} setCancelReminder={setCancelReminder}
                        />
                    )}
                    {activeTab === "History" && (
                        <HistoryRemindersTab
                            reminders={reminders} loading={loading}
                            page={page} total={total} totalPages={totalPages} setPage={setPage}
                            setViewReminder={setViewReminder}
                        />
                    )}
                    {activeTab === "Bulk" && <BulkTab patients={patients} />}
                </main>
            </div>
            {showCreate && (
                <ReminderModal patients={patients} onClose={() => { setShowCreate(false); fetchReminders(); fetchStats(); }} onSaved={() => { fetchReminders(); fetchStats(); }} />
            )}
            {editReminder && (
                <EditScheduledReminderModal reminder={editReminder} onClose={() => setEditReminder(null)} onSaved={() => { fetchReminders(); fetchStats(); }} />
            )}
            {viewReminder && (
                <ReminderDrawer
                    reminder={viewReminder}
                    onClose={() => setViewReminder(null)}
                    onEdit={() => { setEditReminder(viewReminder); setViewReminder(null); }}
                    onCancel={() => { setCancelReminder(viewReminder); setViewReminder(null); }}
                />
            )}
            {cancelReminder && (
                <CancelReminderModal
                    reminder={cancelReminder}
                    onClose={() => setCancelReminder(null)}
                    onCanceled={() => { setCancelReminder(null); fetchReminders(); fetchStats(); }}
                />
            )}
        </>
    );
}

function ActiveRemindersTab({ reminders, loading, page, total, totalPages, setPage, setViewReminder, setEditReminder, setCancelReminder }: {
    reminders: Reminder[];
    loading: boolean;
    page: number;
    total: number;
    totalPages: number;
    setPage: (p: number) => void;
    setViewReminder: (r: Reminder) => void;
    setEditReminder: (r: Reminder) => void;
    setCancelReminder: (r: Reminder) => void;
}) {
    return (
        <DataTable
            columns={[ "Destinatario", "Canal", "Estado", "Programado para", "En", "Creado el", "" ]}
            rows={reminders}
            loading={loading}
            skeletonCount={4}
            renderRow={(reminder) => (
                <tr key={reminder.id} className="table-row" onClick={() => setViewReminder(reminder)}>
                    <td className="td">
                        <div className="td-name__primary">{reminder.patient?.name ?? "—"} {reminder.patient?.lastName ?? "—"}</div>
                        <div className="td-name__secondary">{reminder.to}</div>
                    </td>
                    <td className="td"><ChannelBadge channel={reminder.channel} /></td>
                    <td className="td"><ReminderStatusPill status={reminder.status} /></td>
                    <td className="td td--date">{fmtDateAndTime(reminder.sendAt)}</td>
                    <td className="td td--muted">
                        <span className="badge-time">{fmtRelative(reminder.sendAt)}</span>
                    </td>
                    <td className="td td--subtle">{fmtDateAndTime(reminder.sendAt)}</td>
                    <td className="td" onClick={e => e.stopPropagation()}>
                        <div className="td-actions">
                            <button onClick={() => setEditReminder(reminder)} className="btn-action-edit">Reprogramar</button>
                            <button onClick={() => setCancelReminder(reminder)} className="btn-action-delete">✕</button>
                        </div>
                    </td>
                </tr>
            )}
            emptyState={<EmptyState icon="🔔" title="Sin recordatorios activos" sub="Haz clic en Nuevo Recordatorio para programar el primero." />}
            footer={<TableFooter page={page} pageSize={PAGE_SIZE} total={total} totalPages={totalPages} label="recordatorios" onPageChange={setPage} />}
        />
    );
}

function HistoryRemindersTab({ reminders, loading, page, total, totalPages, setPage, setViewReminder }: {
    reminders: Reminder[];
    loading: boolean;
    page: number;
    total: number;
    totalPages: number;
    setPage: (p: number) => void;
    setViewReminder: (r: Reminder) => void;
}) {
    return (
        <DataTable
            columns={[ "Destinatario", "Canal", "Estado", "Programado para", "Última actualización", "ID Mensaje", "Error" ]}
            rows={reminders}
            loading={loading}
            skeletonCount={5}
            renderRow={(reminder) => (
                <tr key={reminder.id} className="table-row" onClick={() => setViewReminder(reminder)}>
                    <td className="td">
                        <div className="td-name__primary">{reminder.patient?.name ?? "—"} {reminder.patient?.lastName ?? "—"}</div>
                        <div className="td-name__secondary">{reminder.to}</div>
                    </td>
                    <td className="td"><ChannelBadge channel={reminder.channel} /></td>
                    <td className="td"><ReminderStatusPill status={reminder.status} /></td>
                    <td className="td td--muted">{fmtDateAndTime(reminder.sendAt)}</td>
                    <td className="td td--muted">{fmtDateAndTime(reminder.updatedAt)}</td>
                    <td className="td td--mono">
                        {reminder.messageId ? <span title={reminder.messageId}>{reminder.messageId}</span> : "—"}
                    </td>
                    <td className="td td--error-cell">
                        {reminder.error
                            ? <span title={reminder.error} className="td-error__text">{reminder.error.slice(0, 40)}{reminder.error.length > 40 ? "…" : ""}</span>
                            : <span className="td-error__empty">—</span>
                        }
                    </td>
                </tr>
            )}
            emptyState={<EmptyState icon="📋" title="Sin historial aún" sub="Los recordatorios enviados, fallidos y cancelados aparecerán aquí." />}
            footer={<TableFooter page={page} pageSize={PAGE_SIZE} total={total} totalPages={totalPages} label="recordatorios" onPageChange={setPage} />}
        />
    );
}

function BulkTab({ patients }: { patients: import("@/src/types/Patient").Patient[] }) {
    return (
        <div className="bulk-section fade-in">
            <div className="info-banner">
                <span className="bulk-info__icon">📣</span>
                <div>
                    <div className="bulk-info__title">Envío Masivo</div>
                    <div className="bulk-info__desc">
                        Envía el mismo mensaje a múltiples pacientes a la vez. Solo se incluyen pacientes con estado <strong>Activo</strong> y número registrado para el canal seleccionado.
                    </div>
                </div>
            </div>
            <BulkSendWizard patients={patients} />
        </div>
    );
}

function ReminderTabs({ activeTab, setActiveTab, stats }: {
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;
    stats: ReturnType<typeof useFetchRemindersStats>[ "stats" ];
}) {
    const tabs = [
        { key: ActiveTab.Active, label: "Activos", badge: (stats?.byStatus[ ReminderStatus.PENDING ] || 0) + (stats?.byStatus[ ReminderStatus.QUEUED ] || 0) },
        { key: ActiveTab.History, label: "Historial", badge: (stats?.byStatus[ ReminderStatus.SENT ] || 0) + (stats?.byStatus[ ReminderStatus.FAILED ] || 0) + (stats?.byStatus[ ReminderStatus.CANCELLED ] || 0) },
        { key: ActiveTab.Bulk, label: "Envío Masivo", badge: null },
    ];

    return (
        <div className="tab-nav">
            {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`filter-chip ${activeTab === tab.key ? "filter-chip--active" : ""}`}>
                    {tab.label}
                    {tab.badge !== null && (
                        <span className={`tab-badge ${activeTab === tab.key ? "tab-badge--active" : ""}`}>{tab.badge}</span>
                    )}
                </button>
            ))}
        </div>
    );
}

export default function RemindersPage() {
    return <Suspense><RemindersPageContent /></Suspense>;
}
