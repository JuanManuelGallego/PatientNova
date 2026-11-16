"use client";

import { useState } from "react";
import { UserCog } from "lucide-react";
import { useFetchUsers } from "@/src/api/users/useFetchUsers";
import { useDeleteUser, useRestoreUser } from "@/src/api/users/useManageUser";
import { mutationErrorMessage } from "@/src/api/base/useApiMutation";
import { InlineError } from "@/src/components/Info/InlineError";
import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { SettingsList } from "@/src/components/Settings/SettingsList";
import { PageHeader } from "@/src/components/PageHeader";
import { TabNav } from "@/src/components/TabNav";
import { ACTION_ICONS } from "@/src/config/icons";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { useAuthContext } from "@/src/providers/AuthContext";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import type { ManagedUser } from "@/src/types/User";
import { UserModal } from "./UserModal";
import { ROLE_LABELS, userDisplayName } from "./userLabels";
import { UserStatusPill } from "./UserStatusPill";

enum UsersTab {
    Active = "active",
    Deleted = "deleted",
}

const TABS = [
    { key: UsersTab.Active, label: "Activos" },
    { key: UsersTab.Deleted, label: "Eliminados" },
];

const BRAND_PILL: React.CSSProperties = { background: "var(--c-brand-light)", color: "var(--c-brand)" };
const SUBTEXT: React.CSSProperties = { fontSize: 12, color: "var(--c-gray-500)", marginTop: 2 };

export function UsersView() {
    const { user: me } = useAuthContext();
    const timezone = useDisplayTimezone();
    const [ tab, setTab ] = useState<UsersTab>(UsersTab.Active);
    const { users, loading, error, refetch } = useFetchUsers({ includeDeleted: true });
    const shown = users?.filter((u) => u.isDeleted === (tab === UsersTab.Deleted));
    const { deleteUser, loading: deleting } = useDeleteUser();
    const { restoreUser, loading: restoring } = useRestoreUser();

    const [ modalUser, setModalUser ] = useState<ManagedUser | null | undefined>(undefined);
    const [ deleteTarget, setDeleteTarget ] = useState<ManagedUser | null>(null);
    const [ deleteError, setDeleteError ] = useState<string | null>(null);
    const [ rowError, setRowError ] = useState<string | null>(null);

    async function confirmDelete() {
        if (!deleteTarget) return;
        setDeleteError(null);
        try {
            await deleteUser(deleteTarget.id);
            setDeleteTarget(null);
            refetch();
        } catch (err) {
            setDeleteError(mutationErrorMessage(err, "No pudimos eliminar la cuenta."));
        }
    }

    async function handleRestore(u: ManagedUser) {
        setRowError(null);
        try {
            await restoreUser(u.id);
            refetch();
        } catch (err) {
            setRowError(mutationErrorMessage(err, "No pudimos restaurar la cuenta."));
        }
    }

    function renderRow(u: ManagedUser) {
        const isMe = u.id === me?.id;
        return (
            <div
                key={u.id}
                className="location-card"
                data-testid={`user-row-${u.id}`}
                style={{ padding: 0, height: "auto" }}
            >
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontWeight: 600, fontSize: 14 }}>
                            <span style={{ overflowWrap: "anywhere" }}>{userDisplayName(u)}</span>
                            {isMe && <span className="pill" style={BRAND_PILL}>Tú</span>}
                            <span className="pill" style={BRAND_PILL}>{ROLE_LABELS[u.role]}</span>
                            <UserStatusPill status={u.status} isDeleted={u.isDeleted} />
                        </div>
                        <div style={{ ...SUBTEXT, overflowWrap: "anywhere" }}>{u.email}</div>
                        <div style={SUBTEXT}>
                            {u.lastLoginAt ? `Último acceso: ${fmtDateTime(u.lastLoginAt, timezone)}` : "Nunca ha iniciado sesión"}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        {u.isDeleted ? (
                            <button type="button" className="btn-secondary" disabled={restoring} onClick={() => handleRestore(u)}>Restaurar</button>
                        ) : (
                            <>
                                <button type="button" className="btn-secondary" onClick={() => { setRowError(null); setModalUser(u); }}>Editar</button>
                                {!isMe && (
                                    <button type="button" className="btn-secondary" onClick={() => { setRowError(null); setDeleteError(null); setDeleteTarget(u); }}>Eliminar</button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-stack">
            <PageHeader
                title="Usuarios"
                subtitle="Cuentas de los profesionales que usan Patient Nova"
                actions={<button type="button" className="btn-primary btn-hero" onClick={() => setModalUser(null)} data-testid="users-new-button">Nuevo usuario</button>}
            />
            <TabNav
                items={TABS}
                active={tab}
                onSelect={(key) => { setRowError(null); setTab(key as UsersTab); }}
                testIdPrefix="users-tab"
            />
            {rowError && <InlineError message={rowError} />}
            <SettingsList<ManagedUser>
                title="Cuentas"
                description="Crea, edita o desactiva el acceso de cada profesional"
                items={shown}
                loading={loading}
                error={error}
                onRetry={() => refetch()}
                empty={tab === UsersTab.Deleted
                    ? { icon: ACTION_ICONS.delete, title: "Sin cuentas eliminadas", sub: "Las cuentas que elimines aparecerán aquí para restaurarlas." }
                    : { icon: UserCog, title: "Sin usuarios", sub: "Crea la primera cuenta con «Nuevo usuario»." }}
                renderItem={renderRow}
            />
            {modalUser !== undefined && (
                <UserModal
                    user={modalUser}
                    onClose={() => setModalUser(undefined)}
                    onSaved={() => { setModalUser(undefined); refetch(); }}
                />
            )}
            {deleteTarget && (
                <ConfirmDialog
                    icon={ACTION_ICONS.delete}
                    title={`¿Eliminar a ${userDisplayName(deleteTarget)}?`}
                    confirmLabel="Eliminar"
                    loading={deleting}
                    error={deleteError}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={confirmDelete}
                >
                    <p className="modal-confirm__text">No podrá iniciar sesión y se cerrarán sus sesiones. Sus pacientes y citas se conservan, y puedes restaurar la cuenta después.</p>
                </ConfirmDialog>
            )}
        </div>
    );
}
