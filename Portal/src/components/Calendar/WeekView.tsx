import { HOUR_HEIGHT, toDateStr, TODAY_STR, DAY_NAMES_ES, layoutDayAppointments, layoutBlockedTimes } from "./constants";
import { calendarStyles } from "./styles";
import { WeekViewProps } from "./types";
import { ApptChip } from "./ApptChip";
import { BlockedTimeBlock } from "./BlockedTimeBlock";

export function WeekView({
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
}: WeekViewProps) {
  const { hours, firstHour, lastHour } = hourRange;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = nowMin >= firstHour * 60 && nowMin <= (lastHour + 1) * 60;
  const nowTop = ((nowMin - firstHour * 60) / 60) * HOUR_HEIGHT;

  return (
    <div style={{ overflowX: "auto", position: "relative" }}>
      <div
        style={{
          minWidth: 640,
          opacity: loading ? 0.5 : 1,
          transition: "opacity 0.15s",
          pointerEvents: loading ? "none" : "auto",
        }}
      >
        <div style={calendarStyles.weekGrid}>
          <div style={calendarStyles.weekGutter} />
          {weekDays.map((day, di) => {
            const ds = toDateStr(day);
            const isToday = ds === TODAY_STR;
            const holiday = holidayMap[ ds ];
            const dayAppts = apptByDate[ ds ] ?? [];
            return (
              <div
                key={di}
                style={{
                  ...calendarStyles.weekDayHeader,
                  background: isToday
                    ? "var(--c-primary-50, #eff6ff)"
                    : "var(--c-gray-50, #f9fafb)",
                  borderBottom: isToday
                    ? "2px solid var(--c-primary, #2563eb)"
                    : "2px solid var(--c-gray-200, #e5e7eb)",
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
                  <span title={holiday} style={{ fontSize: 11, opacity: 0.7 }}>
                    🇨🇴
                  </span>
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
                  borderTop: "1px solid var(--c-gray-100, #f3f4f6)",
                  boxSizing: "border-box",
                }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flex: 1, position: "relative" }}>
            {weekDays.map((day, di) => {
              const ds = toDateStr(day);
              const isToday = ds === TODAY_STR;
              const positioned = layoutDayAppointments(
                apptByDate[ ds ] ?? [],
                firstHour,
              );
              return (
                <div
                  key={di}
                  style={{
                    flex: 1,
                    position: "relative",
                    borderLeft: "1px solid var(--c-gray-100, #f3f4f6)",
                    minWidth: 0,
                    background: isToday
                      ? "var(--c-primary-50, #eff6ff)"
                      : "var(--c-surface, #fff)",
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
                    onClick={(e) => {
                      const y = e.nativeEvent.offsetY;
                      const totalMinutes = Math.round(((y / HOUR_HEIGHT) * 60) / 5) * 5;
                      const hour = firstHour + Math.floor(totalMinutes / 60);
                      const minute = totalMinutes % 60;
                      const d = new Date(ds + "T" + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0") + ":00");
                      onCreateAt(d.toISOString());
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
                  {layoutBlockedTimes(blockedByDate[ ds ] ?? [], firstHour).map((p) => (
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
                  {showNow && isToday && (
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
              );
            })}
          </div>
        </div>
      </div>
      {loading && <div className="cal-loading-overlay">Cargando citas…</div>}
    </div>
  );
}
