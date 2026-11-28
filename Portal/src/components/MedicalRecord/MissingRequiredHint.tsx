import { STATUS_ICONS } from "@/src/config/icons";

export function MissingRequiredHint({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <div className="info-banner" role="status" style={{ alignItems: "center", gap: 8 }} data-testid="medical-records-missing-required">
      <STATUS_ICONS.warning size={14} aria-hidden /> Campos obligatorios sin completar: {labels.join(", ")}
    </div>
  );
}
