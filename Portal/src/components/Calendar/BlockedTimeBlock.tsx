import { fmtTime } from "@/src/utils/TimeUtils";
import { BlockedTimeBlockProps } from "./types";

export function BlockedTimeBlock({ bt, onSelectBlockedTime, style }: BlockedTimeBlockProps) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelectBlockedTime(bt); }}
      className="cal-blocked-block"
      style={{
        position: "absolute",
        background: "var(--c-gray-100)",
        borderLeft: "3px solid var(--c-gray-400)",
        cursor: "pointer",
        zIndex: 0,
        ...style,
      }}
      title={bt.description || "Horario bloqueado"}
    >
      <span style={{ fontSize: 10, color: "var(--c-gray-600)", padding: "2px 4px", fontWeight: 500 }}>
        {fmtTime(bt.startTimeUtc)} - {fmtTime(bt.endTimeUtc)}
        {bt.description && ` ${bt.description}`}
      </span>
    </div>
  );
}
