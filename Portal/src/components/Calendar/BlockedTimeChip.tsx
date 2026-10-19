import { fmtTime } from "@/src/utils/TimeUtils";
import { BlockedTimeChipProps } from "./types";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";

export function BlockedTimeChip({ bt, onSelectBlockedTime, style }: BlockedTimeChipProps) {
  const timezone = useDisplayTimezone();
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelectBlockedTime(bt); }}
      data-testid={`calendar-blocked-${bt.id}`}
      className="cal-chip"
      style={{
        background: "var(--c-gray-100)",
        color: "var(--c-gray-600)",
        width: "100%",
        ...style,
      }}
      title={bt.description || "Horario bloqueado"}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 2,
          background: "var(--c-gray-400)",
          display: "inline-block",
          verticalAlign: "middle",
        }}
        title="Horario bloqueado"
      />
      {" "}
      {fmtTime(bt.startTimeUtc, timezone)} {bt.description?.trim() || "Bloqueado"}
    </div>
  );
}
