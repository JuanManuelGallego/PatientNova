import { AppointmentLocation } from "../types/Appointment";

export function LocationCard({
    loc,
    onEdit,
    onDelete,
    onReactivate,
    inactive = false,
}: {
    loc: AppointmentLocation;
    onEdit?: () => void;
    onDelete?: () => void;
    onReactivate?: () => void;
    inactive?: boolean;
}) {
    return (
        <div
            className="location-card"
            style={{ padding: 0, overflow: "hidden", borderLeft: `4px solid ${loc.color || "#2563EB"}`, opacity: inactive ? 0.6 : 1 }}
        >
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 14 }}>
                        {loc.name}
                        {loc.isVirtual && (
                            <span style={{
                                fontSize: 10, fontWeight: 600,
                                background: "var(--c-brand-light)", color: "var(--c-brand)",
                                borderRadius: "var(--r-full)", padding: "2px 8px",
                                letterSpacing: "0.03em", flexShrink: 0,
                            }}>
                                Virtual
                            </span>
                        )}
                    </div>
                    {loc.address && (
                        <div style={{
                            fontSize: 12, color: "var(--c-gray-400)",
                            marginTop: 2, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                            {loc.isVirtual ? "🔗" : "📌"} {loc.address}
                        </div>
                    )}
                </div>
                {inactive ? (
                    <button className="btn-secondary btn-sm" onClick={onReactivate}>
                        Reactivar
                    </button>) : (
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

