import { AppointmentStatus, APPT_STATUS_CFG } from "@/src/types/Appointment";
import { fmtTime } from "@/src/utils/TimeUtils";
import { ApptChipProps } from "../types";

export function ApptChip({ a, compact = false, onViewAppt, style }: ApptChipProps) {
  const isCancelled = a.status === AppointmentStatus.CANCELLED;
  const isNoShow = a.status === AppointmentStatus.NO_SHOW;
  const isCompleted = a.status === AppointmentStatus.COMPLETED;
  const cfg = APPT_STATUS_CFG[ a.status ];

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onViewAppt(a); }}
      className={[
        "cal-chip",
        isCancelled ? "cal-chip--cancelled" : "",
        isNoShow ? "cal-chip--no-show" : "",
        isCompleted ? "cal-chip--completed" : "",
      ]
        .filter(Boolean).join(" ")}
      style={{
        background: a.appointmentLocation.color ? a.appointmentLocation.color + "15" : "var(--c-gray-200)",
        color: a.appointmentLocation.color ?? "var(--c-gray-700)",
        width: compact ? undefined : "100%",
        marginBottom: compact ? 0 : 2,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        ...style,
      }}
      title={`${a.patient.name} ${a.patient.lastName} — ${a.appointmentLocation.name} — ${cfg.label}`}
    >
      {compact ? (
        <span style={{ color: cfg.dot, flexShrink: 0 }} title={cfg.label} aria-label={cfg.label}>●</span>
      ) : (
        <span style={{
          background: cfg.bg, color: cfg.color, fontSize: 11,
          padding: "2px 8px", borderRadius: 6, flexShrink: 0,
        }}>
          {cfg.label}
        </span>
      )}

      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
        {fmtTime(a.startAt)} {a.patient.name} {a.patient.lastName}
        {!compact && ` — ${a.appointmentLocation.name}`}
      </span>
    </div>
  );
}
