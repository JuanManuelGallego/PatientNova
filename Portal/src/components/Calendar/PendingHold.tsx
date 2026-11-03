import type { CSSProperties } from "react";
import { fmtTime } from "@/src/utils/TimeUtils";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import type { HeldSlot } from "./constants";

export const HOLD_LABEL = "Pendiente de revisión";

interface PendingHoldProps {
  hold: HeldSlot;
  onSelectHold: (id: string) => void;
  style?: CSSProperties;
}

/** Week view: a dashed block over the held slot. */
export function PendingHoldBlock({ hold, onSelectHold, style }: PendingHoldProps) {
  const timezone = useDisplayTimezone();
  return (
    <button
      type="button"
      className="cal-hold"
      data-testid={`calendar-hold-${hold.id}`}
      onClick={(e) => { e.stopPropagation(); onSelectHold(hold.id); }}
      title={`${HOLD_LABEL}: ${hold.name} ${hold.lastName}`}
      style={{
        position: "absolute",
        zIndex: 1,
        borderRadius: 4,
        display: "flex",
        alignItems: "flex-start",
        padding: "2px 4px",
        fontSize: 10,
        fontWeight: 600,
        textAlign: "left",
        overflow: "hidden",
        ...style,
      }}
    >
      {fmtTime(hold.startAt, timezone)} {HOLD_LABEL}
    </button>
  );
}

/** Month view and day panel: a dashed chip. */
export function PendingHoldChip({ hold, onSelectHold, style }: PendingHoldProps) {
  const timezone = useDisplayTimezone();
  return (
    <button
      type="button"
      className="cal-chip cal-hold"
      data-testid={`calendar-hold-${hold.id}`}
      onClick={(e) => { e.stopPropagation(); onSelectHold(hold.id); }}
      title={`${HOLD_LABEL}: ${hold.name} ${hold.lastName}`}
      style={{ width: "100%", textAlign: "left", ...style }}
    >
      {fmtTime(hold.startAt, timezone)} {HOLD_LABEL}
    </button>
  );
}
