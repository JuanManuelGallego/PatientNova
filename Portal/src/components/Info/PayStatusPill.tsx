import { STATUS_ICONS } from "@/src/config/icons";

export function PayStatusPill({ paid, standalone = false }: { paid: boolean; standalone?: boolean }) {
    const Icon = paid ? STATUS_ICONS.success : STATUS_ICONS.pending;
    return (
        <span className="pill status-icon-pill">
            <Icon
                size={15}
                style={{ color: paid ? "var(--c-success)" : "var(--c-warning)" }}
                aria-hidden="true"
            />
            {paid ? "Pagado" : standalone ? "Sin pagar" : "Pendiente"}
        </span>
    );
}
