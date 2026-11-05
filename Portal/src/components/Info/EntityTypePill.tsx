import { EntityType, ENTITY_TYPE_CONFIG, UNKNOWN_PILL_STYLE } from "@/src/types/AuditLog";

export function EntityTypePill({ entityType }: { entityType: EntityType }) {
  const c = ENTITY_TYPE_CONFIG[entityType] ?? { label: entityType, ...UNKNOWN_PILL_STYLE };
  return (
    <span className="pill" style={{ color: c.color, backgroundColor: c.bg, fontWeight: 600 }}>
      {c.label}
    </span>
  );
}
