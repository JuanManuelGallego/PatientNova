import Image from "next/image";
import { flagUrl } from "@/src/components/CountryCodeInput";
import { HOURS, TODAY_STR, apptHour } from "../constants";
import { calendarStyles } from "../styles";
import { ApptChip } from "./ApptChip";
import { DayViewProps } from "../types";

export function DayView({
  dayDate,
  apptByDate,
  holidayMap,
  loading,
  onViewAppt,
  onCreateAt,
}: DayViewProps) {
  const dayAppts = apptByDate[ dayDate ] ?? [];
  const holiday = holidayMap[ dayDate ];
  const isToday = dayDate === TODAY_STR;

  return (
    <div style={{ overflowX: "hidden" }}>
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
      {loading ? (
        <div className="cal-loading">Cargando citas…</div>
      ) : (
        <div style={calendarStyles.dayGrid}>
          {HOURS.map((hour) => {
            const slotAppts = dayAppts.filter((a) => apptHour(a) === hour);
            return (
              <div key={hour} style={calendarStyles.dayRow}>
                <div style={calendarStyles.dayTimeLabel}>
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div
                  style={{
                    ...calendarStyles.daySlot,
                    background:
                      isToday && hour === new Date().getHours()
                        ? "var(--c-primary-50, #eff6ff)"
                        : "transparent",
                  }}
                  onClick={() => onCreateAt(dayDate)}
                  title={`Nueva cita ${String(hour).padStart(2, "0")}:00`}
                >
                  {slotAppts.map((a) => (
                    <ApptChip key={a.id} a={a} onViewAppt={onViewAppt} />
                  ))}
                </div>
              </div>
            );
          })}
          {dayAppts.length === 0 && !loading && (
            <p style={calendarStyles.dayEmpty}>No hay citas para este día.</p>
          )}
        </div>
      )}
    </div>
  );
}
