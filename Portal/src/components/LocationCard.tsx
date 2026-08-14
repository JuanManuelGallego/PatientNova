import { AppointmentLocation } from "@/src/types/Appointment";
import { ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";

export function LocationCard({
  loc,
  onEdit,
  onDelete,
}: {
  loc: AppointmentLocation;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className="location-card"
      data-testid={`location-card-${loc.id}`}
      style={{
        padding: 0,
        overflow: "hidden",
        borderLeft: `4px solid ${loc.color || "#2563EB"}`,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {loc.name}
            {loc.isVirtual && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  background: "var(--c-brand-light)",
                  color: "var(--c-brand)",
                  borderRadius: "var(--r-full)",
                  padding: "2px 8px",
                  letterSpacing: "0.03em",
                  flexShrink: 0,
                }}
              >
                Virtual
              </span>
            )}
          </div>
          {loc.address && (
            <div
              style={{
                fontSize: 12,
                color: "var(--c-gray-400)",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 6
              }}
            >
              {loc.isVirtual ? (
                <DETAIL_ICONS.link size={12} />
              ) : (
                <DETAIL_ICONS.mapPin size={12} />
              )}{" "}
              {loc.address}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button className="btn-action-edit" onClick={onEdit} title="Editar" data-testid={`location-edit-button-${loc.id}`}>
            <ACTION_ICONS.edit size={14} /> Editar
          </button>
          <button
            className="btn-action-delete"
            onClick={onDelete}
            title="Eliminar"
            data-testid={`location-delete-button-${loc.id}`}
          >
            <ACTION_ICONS.close size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
