import { AdminRole, AdminStatus, User } from "@/src/types/User";

export const ROLE_LABELS: Record<AdminRole, string> = {
    [AdminRole.VIEWER]: "Lector",
    [AdminRole.ADMIN]: "Administrador",
    [AdminRole.SUPER_ADMIN]: "Superadministrador",
};

export const STATUS_LABELS: Record<AdminStatus, string> = {
    [AdminStatus.ACTIVE]: "Activo",
    [AdminStatus.INACTIVE]: "Inactivo",
    [AdminStatus.PENDING]: "Pendiente",
};

export function userDisplayName(u: Pick<User, "displayName" | "firstName" | "lastName" | "email">): string {
    if (u.displayName?.trim()) return u.displayName.trim();
    const full = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
    return full || u.email;
}
