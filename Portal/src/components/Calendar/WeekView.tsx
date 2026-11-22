import { HOUR_HEIGHT, toDateStr, DAY_NAMES_ES, layoutDayAppointments, layoutBlockedTimes, layoutHolds } from "./constants";
import { fmtHourLabel, localDateTimeToUtc, todayFormattedString, zonedDateTimeParts } from "@/src/utils/TimeUtils";
import { calendarStyles } from "./styles";
import { WeekViewProps } from "./types";
import { ApptChip } from "./ApptChip";
import { BlockedTimeBlock } from "./BlockedTimeBlock";
import { PendingHoldBlock } from "./PendingHold";
import Image from "next/image";
import { flagUrl } from "../CountryCodeInput";

export function WeekView({
  timezone,
  weekDays,
  apptByDate,
  blockedByDate,
  holidayMap,
  loading,
  hourRange,
  onDrillToDay,
  onViewAppt,
  onCreateAt,
  onSelectBlockedTime,
  holdByDate,
  onSelectHold,
}: WeekViewProps) {
  const { hours, firstHour, lastHour } = hourRange;
  const today = todayFormattedString(timezone);

  const now = zonedDateTimeParts(new Date(), timezone);
  const nowMin = now.hour * 60 + now.minute;
  const showNow = nowMin >= firstHour * 60 && nowMin <= (lastHour + 1) * 60;
  const nowTop = ((nowMin - firstHour * 60) / 60) * HOUR_HEIGHT;

  return (
    <div style={{ overflowX: "auto", position: "relative" }}>
      <div
        style={{
          // Fits the 7 columns at 640px (where the phone agenda stops) inside the page padding and card border.
          minWidth: 560,
          opacity: loading ? 0.5 : 1,
          transition: "opacity 0.15s",
          pointerEvents: loading ? "none" : "auto",
        }}
      >
        <div style={calendarStyles.weekGrid}>
          <div style={calendarStyles.weekGutter} />
          {weekDays.map((day, di) => {
            const ds = toDateStr(day);
            const isToday = ds === today;
            const holiday = holidayMap[ ds ];
            const dayAppts = apptByDate[ ds ] ?? [];
            return (
              <div
                key={di}
                style={{
                  ...calendarStyles.weekDayHeader,
                  background: isToday
                    ? "var(--c-today-bg)"
                    : "var(--c-gray-50)",
                  borderBottom: isToday
                    ? "2px solid var(--c-brand)"
                    : "2px solid var(--c-gray-200)",
                }}
              >
                <span style={calendarStyles.weekDayName}>
                  {DAY_NAMES_ES[ di ]}
                </span>
                <span
                  style={{
                    ...calendarStyles.weekDayNum,
                    ...(isToday ? calendarStyles.weekDayNumToday : {}),
                  }}
                  onClick={() => onDrillToDay(ds)}
                  title="Ver en vista día"
                >
                  {day.getDate()}
                </span>
                {holiday && (
                  <div className="cal-holiday-label">
                    <Image
                      className="phone-input-flag"
                      src={flagUrl("co")}
                      alt="Colombia"
                      width={20}
                      height={15}
                    /> {holiday}
                  </div>
                )}
                {dayAppts.length > 0 && (
                  <span style={calendarStyles.weekDayCount}>
                    {dayAppts.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex" }}>
          <div style={{ width: 56, flexShrink: 0 }}>
            {hours.map((hour) => (
              <div
                key={`lbl-${hour}`}
                style={{
                  ...calendarStyles.weekTimeLabel,
                  height: HOUR_HEIGHT,
                  borderTop: "1px solid var(--c-gray-100)",
                  boxSizing: "border-box",
                }}
              >
                {fmtHourLabel(hour)}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flex: 1, position: "relative" }}>
            {weekDays.map((day, di) => {
              const ds = toDateStr(day);
              const isToday = ds === today;
              const holiday = holidayMap[ ds ];
              const positioned = layoutDayAppointments(
                apptByDate[ ds ] ?? [],
                firstHour,
                timezone,
                ds,
              );
              return (
                <div
                  key={di}
                  className={holiday ? "cal-cell--holiday" : undefined}
                  style={{
                    flex: 1,
                    position: "relative",
                    borderLeft: "1px solid var(--c-gray-100)",
                    minWidth: 0,
                    background: isToday
                      ? "var(--c-today-bg)"
                      : holiday
                        ? "rgba(255, 215, 0, 0.07)"
                        : "var(--c-surface)",
                  }}
                >
                  {hours.map((hour) => (
                    <div
                      key={`bg-${hour}`}
                      style={{
                        height: HOUR_HEIGHT,
                        borderTop: "1px solid var(--c-gray-100)",
                        boxSizing: "border-box",
                      }}
                    />
                  ))}
                  <div
                    style={{ position: "absolute", inset: 0, cursor: "pointer" }}
                    onClick={(e) => {
                      const y = e.nativeEvent.offsetY;
                      const hour = firstHour + Math.floor(y / HOUR_HEIGHT);
                      onCreateAt(localDateTimeToUtc(ds, `${String(hour).padStart(2, "0")}:00:00`, timezone));
                    }}
                    title="Nueva cita"
                  />
                  {positioned.map((p) => (
                    <ApptChip
                      key={p.a.id}
                      a={p.a}
                      compact
                      onViewAppt={onViewAppt}
                      style={{
                        position: "absolute",
                        top: p.top,
                        height: p.height,
                        left: `${p.left}%`,
                        width: `calc(${p.width}% - 4px)`,
                        zIndex: 1,
                      }}
                    />
                  ))}
                  {layoutBlockedTimes(blockedByDate[ ds ] ?? [], firstHour, timezone, ds).map((p) => (
                    <BlockedTimeBlock
                      key={p.bt.id}
                      bt={p.bt}
                      onSelectBlockedTime={onSelectBlockedTime}
                      style={{
                        top: p.top,
                        height: p.height,
                        left: 0,
                        right: 0,
                      }}
                    />
                  ))}
                  {onSelectHold && layoutHolds(holdByDate?.[ ds ] ?? [], firstHour, timezone, ds).map((p) => (
                    <PendingHoldBlock
                      key={p.hold.id}
                      hold={p.hold}
                      onSelectHold={onSelectHold}
                      style={{ top: p.top, height: p.height, left: 0, right: 4 }}
                    />
                  ))}
                  {showNow && isToday && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: nowTop,
                        height: 2,
                        background: "var(--c-error)",
                        zIndex: 2,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {loading && <div className="cal-loading-overlay">Cargando citas…</div>}
    </div>
  );
}
