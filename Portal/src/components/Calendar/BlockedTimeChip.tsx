import { fmtTime } from "@/src/utils/TimeUtils";
import { BlockedTimeChipProps } from "./types";

export function BlockedTimeChip({ bt, onSelectBlockedTime, style }: BlockedTimeChipProps) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelectBlockedTime(bt); }}
      className="cal-chip cal-chip--blocked"
      style={{
        background: "repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 4px, #e5e7eb 4px, #e5e7eb 8px)",
        color: "var(--c-gray-600)",
        width: "100%",
        marginBottom: 2,
        cursor: "pointer",
        ...style,
      }}
      title={bt.description || "Horario bloqueado"}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {fmtTime(bt.startTimeUtc)} {bt.description || "Bloqueado"}
      </span>
    </div>
  );
}
