"use client";

import { useState } from "react";
import { UserCog } from "lucide-react";
import { useFetchUsers } from "@/src/api/users/useFetchUsers";
import { useDeleteUser, useRestoreUser } from "@/src/api/users/useManageUser";
import { mutationErrorMessage } from "@/src/api/base/useApiMutation";
import { InlineError } from "@/src/components/Info/InlineError";
import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { SettingsList } from "@/src/components/Settings/SettingsList";
import { ACTION_ICONS } from "@/src/config/icons";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { useAuthContext } from "@/src/providers/AuthContext";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import type { ManagedUser } from "@/src/types/User";
import { UserModal } from "./UserModal";
import { ROLE_LABELS, STATUS_LABELS, userDisplayName } from "./userLabels";

const PILL: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    background: "var(--c-brand-light)",
    color: "var(--c-brand)",
    borderRadius: "var(--r-full)",
    padding: "2px 8px",
};

export function UsersView() {
    const { user: me } = useAuthContext();
    const timezone = useDisplayTimezone();
    const [ includeDeleted, setIncludeDeleted ] = useState(false);
    const { users, loading, error, refetch } = useFetchUsers({ includeDeleted });
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
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
            >
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontWeight: 600, fontSize: 14 }}>
                        {userDisplayName(u)}
                        {isMe && <span style={PILL}>Tú</span>}
                        <span style={PILL}>{ROLE_LABELS[u.role]}</span>
                        <span style={PILL}>{u.isDeleted ? "Eliminado" : STATUS_LABELS[u.status]}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--c-gray-400)", marginTop: 2, wordBreak: "break-word" }}>{u.email}</div>
                    <div style={{ fontSize: 12, color: "var(--c-gray-400)", marginTop: 2 }}>
                        {u.lastLoginAt ? `Último acceso: ${fmtDateTime(u.lastLoginAt, timezone)}` : "Nunca ha iniciado sesión"}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
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
        );
    }

    return (
        <div className="settings-stack">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                    type="checkbox"
                    checked={includeDeleted}
                    onChange={(e) => setIncludeDeleted(e.target.checked)}
                    data-testid="users-show-deleted"
                />
                Mostrar eliminados
            </label>
            {rowError && <InlineError message={rowError} />}
            <SettingsList<ManagedUser>
                title="Cuentas"
                description="Crea, edita o desactiva el acceso de cada profesional"
                newLabel="Nuevo usuario"
                newTestId="users-new-button"
                onNew={() => setModalUser(null)}
                items={users}
                loading={loading}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: UserCog, title: "Sin usuarios", sub: "Crea la primera cuenta con «Nuevo usuario»." }}
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
