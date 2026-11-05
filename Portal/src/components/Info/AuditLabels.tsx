import type { LucideIcon } from "lucide-react";
import { AUDIT_ACTION_ICONS, AUDIT_ENTITY_ICONS } from "@/src/config/icons";
import {
  ActionType,
  EntityType,
  ACTION_TYPE_CONFIG,
  ENTITY_TYPE_CONFIG,
  UNKNOWN_PILL_STYLE,
  actionTypeLabel,
  entityTypeLabel,
} from "@/src/types/AuditLog";

function IconLabel({ icon: Icon, color, label }: { icon?: LucideIcon; color: string; label: string }) {
  return (
    <span className="td-icon-label">
      {Icon && <Icon size={14} color={color} aria-hidden="true" />}
      {label}
    </span>
  );
}

export function ActionLabel({ action }: { action: ActionType }) {
  return (
    <IconLabel
      icon={AUDIT_ACTION_ICONS[action]}
      color={ACTION_TYPE_CONFIG[action]?.color ?? UNKNOWN_PILL_STYLE.color}
      label={actionTypeLabel(action)}
    />
  );
}

export function EntityTypeLabel({ entityType }: { entityType: EntityType }) {
  return (
    <IconLabel
      icon={AUDIT_ENTITY_ICONS[entityType]}
      color={ENTITY_TYPE_CONFIG[entityType]?.color ?? UNKNOWN_PILL_STYLE.color}
      label={entityTypeLabel(entityType)}
    />
  );
}
