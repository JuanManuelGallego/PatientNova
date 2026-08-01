import { EntityType, ENTITY_TYPE_CONFIG } from "@/src/types/AuditLog";

export function EntityTypePill({ entityType }: { entityType: EntityType }) {
  const c = ENTITY_TYPE_CONFIG[entityType];
  return (
    <span className="pill" style={{ color: c.color, backgroundColor: c.bg, fontWeight: 600 }}>
      {c.label}
    </span>
  );
}
