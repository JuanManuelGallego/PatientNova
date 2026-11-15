"use client";

import { useId, useState } from "react";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import { useCreateUser, useUpdateUser } from "@/src/api/users/useManageUser";
import { mutationErrorMessage } from "@/src/api/base/useApiMutation";
import { useAuthContext } from "@/src/providers/AuthContext";
import { RequiredField } from "@/src/components/Info/Required";
import { InlineError } from "@/src/components/Info/InlineError";
import { PasswordRules, meetsPasswordRules } from "@/src/components/Settings/PasswordRules";
import { ROLE_LABELS, STATUS_LABELS } from "@/src/components/Admin/userLabels";
import { ACTION_ICONS } from "@/src/config/icons";
import { LBL_CANCEL, LBL_SAVING, ERR_SAVE } from "@/src/constants/ui";
import { AdminRole, AdminStatus, type ManagedUser, type User } from "@/src/types/User";

interface UserModalProps {
    user: ManagedUser | null;
    onClose: () => void;
    onSaved: () => void;
}

interface Form {
    firstName: string;
    lastName: string;
    displayName: string;
    jobTitle: string;
    email: string;
    role: AdminRole;
    status: AdminStatus;
    password: string;
}

const TEXT_KEYS = [ "firstName", "lastName", "displayName", "jobTitle", "email" ] as const;

/** The server's limits (`user.schemas.ts`); email follows RFC 5321. */
const MAX_LENGTH: Record<typeof TEXT_KEYS[number], number> = {
    firstName: 100, lastName: 100, displayName: 100, jobTitle: 120, email: 254,
};

const HINT: React.CSSProperties = { fontSize: 12, color: "var(--c-gray-500)", margin: 0 };

/** Only the current role/status of a legacy row is offered beyond the two assignable ones. */
function options<T extends string>(base: T[], current: T | undefined): T[] {
    return current && !base.includes(current) ? [ ...base, current ] : base;
}

export function UserModal({ user, onClose, onSaved }: UserModalProps) {
    const isEdit = !!user;
    const { user: me, refreshUser, logout } = useAuthContext();
    const isSelf = !!user && user.id === me?.id;
    const { createUser } = useCreateUser();
    const { updateUser } = useUpdateUser();
    const { ref, handleKeyDown } = useFocusTrap<HTMLDivElement>(onClose);
    const titleId = useId();
    const emailHintId = useId();
    const selfLockHintId = useId();
    const rulesId = useId();
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ form, setForm ] = useState<Form>({
        firstName: user?.firstName ?? "",
        lastName: user?.lastName ?? "",
        displayName: user?.displayName ?? "",
        jobTitle: user?.jobTitle ?? "",
        email: user?.email ?? "",
        role: user?.role ?? AdminRole.ADMIN,
        status: user?.status ?? AdminStatus.ACTIVE,
        password: "",
    });

    const roles = options([ AdminRole.ADMIN, AdminRole.SUPER_ADMIN ], user?.role);
    const statuses = options([ AdminStatus.ACTIVE, AdminStatus.INACTIVE ], user?.status);
    const set = (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [field]: e.target.value }));

    const rulesOk = meetsPasswordRules(form.password);
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const required = form.firstName.trim() && form.lastName.trim() && form.email.trim();
    const canSubmit = !saving && !!required && (isEdit || rulesOk);

    function buildCreate(): Partial<User> {
        const t = (k: typeof TEXT_KEYS[number]) => form[k].trim();
        const data: Record<string, string> = {
            firstName: t("firstName"),
            lastName: t("lastName"),
            email: t("email"),
            password: form.password,
            role: form.role,
            status: form.status,
        };
        if (t("displayName")) data.displayName = t("displayName");
        if (t("jobTitle")) data.jobTitle = t("jobTitle");
        return data as Partial<User>;
    }

    function buildChanges(current: ManagedUser): Partial<User> {
        const changes: Record<string, string> = {};
        for (const k of TEXT_KEYS) {
            let value = form[k].trim();
            // The server stores emails lowercased: a change of case alone is no change.
            if (k === "email") value = value.toLowerCase();
            // The server rejects an empty displayName: fall back to the full name, as on create.
            if (k === "displayName" && !value && current.displayName) value = fullName;
            if (value !== (current[k] ?? "")) changes[k] = value;
        }
        if (!isSelf) {
            if (form.role !== current.role) changes.role = form.role;
            if (form.status !== current.status) changes.status = form.status;
        }
        return changes as Partial<User>;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        setError(null);
        try {
            if (user) {
                const changes = buildChanges(user);
                if (Object.keys(changes).length > 0) {
                    await updateUser(user.id, changes);
                    if (isSelf && changes.email !== undefined) {
                        // The new email revoked this session's refresh token: end it now, not mid-task later.
                        onClose();
                        await logout();
                        return;
                    }
                    if (isSelf) await refreshUser();
                    onSaved();
                }
            } else {
                await createUser(buildCreate());
                onSaved();
            }
            onClose();
        } catch (err) {
            setError(mutationErrorMessage(err, ERR_SAVE));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
            <div
                ref={ref}
                className="modal-panel modal-panel--sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                data-testid="user-modal-panel"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2 className="modal-title" id={titleId}>{isEdit ? "Editar usuario" : "Nuevo usuario"}</h2>
                    <button type="button" onClick={onClose} className="btn-close" aria-label="Cerrar" data-testid="user-modal-close-button">
                        <ACTION_ICONS.close size={16} />
                    </button>
                </div>

                <form className="form-stack" onSubmit={handleSubmit}>
                    <label className="form-label">
                        <RequiredField label="Nombre" />
                        <input className="form-input" value={form.firstName} onChange={set("firstName")} maxLength={MAX_LENGTH.firstName} data-testid="user-first-name-input" required />
                    </label>
                    <label className="form-label">
                        <RequiredField label="Apellido" />
                        <input className="form-input" value={form.lastName} onChange={set("lastName")} maxLength={MAX_LENGTH.lastName} data-testid="user-last-name-input" required />
                    </label>
                    <label className="form-label">
                        Nombre visible
                        <input
                            className="form-input"
                            value={form.displayName}
                            onChange={set("displayName")}
                            placeholder={fullName || undefined}
                            maxLength={MAX_LENGTH.displayName}
                            data-testid="user-display-name-input"
                        />
                    </label>
                    <label className="form-label">
                        Cargo
                        <input className="form-input" value={form.jobTitle} onChange={set("jobTitle")} maxLength={MAX_LENGTH.jobTitle} data-testid="user-job-title-input" />
                    </label>
                    <label className="form-label">
                        <RequiredField label="Correo" />
                        <input
                            className="form-input"
                            type="email"
                            value={form.email}
                            onChange={set("email")}
                            maxLength={MAX_LENGTH.email}
                            aria-describedby={isSelf ? emailHintId : undefined}
                            data-testid="user-email-input"
                            required
                        />
                        {isSelf && <span id={emailHintId} style={HINT}>Si cambias tu correo, se cerrará tu sesión al guardar.</span>}
                    </label>
                    <label className="form-label">
                        Rol
                        <select
                            className="form-input"
                            value={form.role}
                            onChange={set("role")}
                            disabled={isSelf}
                            aria-describedby={isSelf ? selfLockHintId : undefined}
                            data-testid="user-role-select"
                        >
                            {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                    </label>
                    <label className="form-label">
                        Estado
                        <select
                            className="form-input"
                            value={form.status}
                            onChange={set("status")}
                            disabled={isSelf}
                            aria-describedby={isSelf ? selfLockHintId : undefined}
                            data-testid="user-status-select"
                        >
                            {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                    </label>
                    {isSelf && <p id={selfLockHintId} style={HINT}>No puedes cambiar tu propio rol ni estado.</p>}

                    {!isEdit && (
                        <>
                            <label className="form-label">
                                <RequiredField label="Contraseña inicial" />
                                <input
                                    className="form-input"
                                    type="password"
                                    autoComplete="new-password"
                                    value={form.password}
                                    onChange={set("password")}
                                    aria-describedby={rulesId}
                                    data-testid="user-password-input"
                                />
                            </label>
                            <PasswordRules password={form.password} id={rulesId} />
                        </>
                    )}

                    {error && <InlineError message={error} />}

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving} data-testid="user-modal-cancel-button">
                            {LBL_CANCEL}
                        </button>
                        <button type="submit" className="btn-primary btn-hero" disabled={!canSubmit} data-testid="user-modal-submit-button">
                            {saving ? LBL_SAVING : isEdit ? "Guardar" : "Crear usuario"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
