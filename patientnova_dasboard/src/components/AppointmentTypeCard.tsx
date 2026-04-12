import { AppointmentType } from "../types/Appointment";

export function AppointmentTypeCard({
    type,
    onEdit,
    onDelete,
    onReactivate,
    inactive = false,
}: {
    type: AppointmentType;
    onEdit?: () => void;
    onDelete?: () => void;
    onReactivate?: () => void;
    inactive?: boolean;
}) {
    return (
        <div
            className="location-card"
            style={{ padding: 0, overflow: "hidden", borderLeft: `4px solid ${type.color || "#7C3AED"}`, opacity: inactive ? 0.6 : 1 }}
        >
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {type.name}
                    </div>
                    <div style={{
                        fontSize: 12, color: "var(--c-gray-400)", marginTop: 2,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                        {type.defaultDuration} min
                        {type.defaultPrice ? ` · $${type.defaultPrice.toLocaleString()}` : ""}
                        {type.description ? ` · ${type.description}` : ""}
                    </div>
                </div>
                {inactive ? (
                    <button className="btn-secondary btn-sm" onClick={onReactivate}>
                        Reactivar
                    </button>
                ) : (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button className="btn-action-edit" onClick={onEdit} title="Editar">
                            ✏️ Editar
                        </button>
                        <button className="btn-action-delete" onClick={onDelete} title="Desactivar">
                            ✖️
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
