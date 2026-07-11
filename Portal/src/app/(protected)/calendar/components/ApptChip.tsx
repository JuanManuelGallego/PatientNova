import { AppointmentStatus } from "@/src/types/Appointment";
import { fmtTime } from "@/src/utils/TimeUtils";
import { ApptChipProps } from "../types";

export function ApptChip({ a, compact = false, onViewAppt }: ApptChipProps) {
  const isCancelled = a.status === AppointmentStatus.CANCELLED;
  const isNoShow = a.status === AppointmentStatus.NO_SHOW;
  const isCompleted = a.status === AppointmentStatus.COMPLETED;
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onViewAppt(a);
      }}
      className={[
        "cal-chip",
        isCancelled ? "cal-chip--cancelled" : "",
        isNoShow ? "cal-chip--no-show" : "",
        isCompleted ? "cal-chip--completed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background: a.appointmentLocation.color + "15" || "var(--c-gray-200)",
        color: a.appointmentLocation.color ?? "var(--c-gray-700)",
        width: compact ? undefined : "100%",
        marginBottom: compact ? 0 : 2,
        cursor: "pointer",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      title={`${a.patient.name} ${a.patient.lastName} — ${a.appointmentLocation.name} — ${a.status}`}
    >
      {fmtTime(a.startAt)} {a.patient.name} {a.patient.lastName}
      {!compact && ` — ${a.appointmentLocation.name}`}
      {a.status === AppointmentStatus.CONFIRMED && " ●"}
      {a.status === AppointmentStatus.SCHEDULED && " ○"}
    </div>
  );
}
