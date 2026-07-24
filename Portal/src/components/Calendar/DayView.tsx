import Image from "next/image";
import { flagUrl } from "@/src/components/CountryCodeInput";
import { ApptChip } from "./ApptChip";
import { TODAY_STR, HOUR_HEIGHT, layoutDayAppointments } from "./constants";
import { calendarStyles } from "./styles";
import { DayViewProps } from "./types";

export function DayView({
  dayDate,
  apptByDate,
  holidayMap,
  loading,
  hourRange,
  onViewAppt,
  onCreateAt,
}: DayViewProps) {
  const dayAppts = apptByDate[ dayDate ] ?? [];
  const holiday = holidayMap[ dayDate ];
  const isToday = dayDate === TODAY_STR;
  const { hours, firstHour, lastHour } = hourRange;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = isToday && nowMin >= firstHour * 60 && nowMin <= (lastHour + 1) * 60;
  const nowTop = ((nowMin - firstHour * 60) / 60) * HOUR_HEIGHT;

  const positioned = layoutDayAppointments(dayAppts, firstHour);

  return (
    <div style={{ overflowX: "hidden", position: "relative" }}>
      {holiday && (
        <div
          className="cal-holiday-label"
          style={{ padding: "6px 16px", marginBottom: 4 }}
        >
          <Image
            className="phone-input-flag"
            src={flagUrl("co")}
            alt="Colombia"
            width={20}
            height={15}
          />{" "}
          {holiday}
        </div>
      )}
      <div
        style={{
          display: "flex",
          opacity: loading ? 0.5 : 1,
          transition: "opacity 0.15s",
          pointerEvents: loading ? "none" : "auto",
        }}
      >
        <div style={{ width: 64, flexShrink: 0 }}>
          {hours.map((hour) => (
            <div
              key={`lbl-${hour}`}
              style={{
                ...calendarStyles.dayTimeLabel,
                height: HOUR_HEIGHT,
                borderTop: "1px solid var(--c-gray-100, #f3f4f6)",
                boxSizing: "border-box",
              }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        <div
          style={{
            flex: 1,
            position: "relative",
            borderLeft: "1px solid var(--c-gray-100, #f3f4f6)",
            minWidth: 0,
          }}
        >
          {hours.map((hour) => (
            <div
              key={`bg-${hour}`}
              style={{
                height: HOUR_HEIGHT,
                borderTop: "1px solid var(--c-gray-100, #f3f4f6)",
                boxSizing: "border-box",
              }}
            />
          ))}
          <div
            style={{ position: "absolute", inset: 0, cursor: "pointer" }}
            onClick={() => onCreateAt(dayDate)}
            title="Nueva cita"
          />
          {positioned.map((p) => (
            <ApptChip
              key={p.a.id}
              a={p.a}
              onViewAppt={onViewAppt}
              style={{
                position: "absolute",
                top: p.top,
                height: p.height,
                left: `${p.left}%`,
                width: `calc(${p.width}% - 6px)`,
                zIndex: 1,
              }}
            />
          ))}
          {showNow && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: nowTop,
                height: 2,
                background: "var(--c-danger, #ef4444)",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>
      {loading && <div className="cal-loading-overlay">Cargando citas…</div>}
      {dayAppts.length === 0 && !loading && (
        <p style={calendarStyles.dayEmpty}>No hay citas para este día.</p>
      )}
    </div>
  );
}
