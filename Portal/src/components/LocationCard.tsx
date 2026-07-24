import { AppointmentLocation } from "@/src/types/Appointment";
import { ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";

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
      style={{
        padding: 0,
        overflow: "hidden",
        borderLeft: `4px solid ${loc.color || "#2563EB"}`,
        opacity: inactive ? 0.6 : 1,
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
        {inactive ? (
          <button className="btn-secondary btn-sm" onClick={onReactivate}>
            Reactivar
          </button>
        ) : (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button className="btn-action-edit" onClick={onEdit} title="Editar">
              <ACTION_ICONS.edit size={14} /> Editar
            </button>
            <button
              className="btn-action-delete"
              onClick={onDelete}
              title="Desactivar"
            >
              <ACTION_ICONS.close size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
