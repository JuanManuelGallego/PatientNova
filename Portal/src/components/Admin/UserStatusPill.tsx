import { STATUS_ICONS, type LucideIcon } from "@/src/config/icons";
import { AdminStatus } from "@/src/types/User";
import { STATUS_LABELS } from "./userLabels";

const STATUS_ICON: Record<AdminStatus, { Icon: LucideIcon; color: string }> = {
    [AdminStatus.ACTIVE]: { Icon: STATUS_ICONS.success, color: "var(--c-success)" },
    [AdminStatus.INACTIVE]: { Icon: STATUS_ICONS.ban, color: "var(--c-warning)" },
    [AdminStatus.PENDING]: { Icon: STATUS_ICONS.pending, color: "var(--c-link)" },
};

/** An account's state: a deleted account reads "Eliminado" whatever its status. */
export function UserStatusPill({ status, isDeleted }: { status: AdminStatus; isDeleted: boolean }) {
    const { Icon, color } = isDeleted
        ? { Icon: STATUS_ICONS.trash, color: "var(--c-error)" }
        : STATUS_ICON[status];
    return (
        <span className="pill status-icon-pill" data-testid="user-status-pill">
            <Icon size={15} style={{ color }} aria-hidden="true" />
            {isDeleted ? "Eliminado" : STATUS_LABELS[status]}
        </span>
    );
}
