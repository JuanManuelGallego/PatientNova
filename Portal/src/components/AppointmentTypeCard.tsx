import { AppointmentType } from "@/src/types/Appointment";

import { ACTION_ICONS } from "@/src/config/icons";

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
      data-testid={`appointment-type-card-${type.id}`}
      style={{
        padding: 0,
        overflow: "hidden",
        borderLeft: `4px solid ${type.color || "#7C3AED"}`,
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
          <div style={{ fontWeight: 600, fontSize: 14 }}>{type.name}</div>
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
            {type.defaultDuration} min
            {type.defaultPrice
              ? ` · $${type.defaultPrice.toLocaleString()}`
              : ""}
            {type.description ? ` · ${type.description}` : ""}
          </div>
        </div>
        {inactive ? (
          <button className="btn-secondary btn-sm" onClick={onReactivate} data-testid={`appointment-type-reactivate-button-${type.id}`}>
            Reactivar
          </button>
        ) : (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button className="btn-action-edit" onClick={onEdit} title="Editar" data-testid={`appointment-type-edit-button-${type.id}`}>
              <ACTION_ICONS.edit size={14} /> Editar
            </button>
            <button
              className="btn-action-delete"
              onClick={onDelete}
              title="Desactivar"
              data-testid={`appointment-type-delete-button-${type.id}`}
            >
              <ACTION_ICONS.close size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
