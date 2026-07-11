import Image from "next/image";
import { flagUrl } from "@/src/components/CountryCodeInput";
import { TODAY_STR, DAY_NAMES_ES } from "../constants";
import { ApptChip } from "./ApptChip";
import { MonthViewProps } from "../types";

export function MonthView({
  rows,
  cellDate,
  apptByDate,
  holidayMap,
  loading,
  onSelectDay,
  onDrillToDay,
  onViewAppt,
}: MonthViewProps) {
  return (
    <div className="table-scroll">
      <div className="cal-day-headers">
        {DAY_NAMES_ES.map((d) => (
          <div key={d} className="cal-day-header">
            {d}
          </div>
        ))}
      </div>
      {loading ? (
        <div className="cal-loading">Cargando citas…</div>
      ) : (
        <div className="cal-grid">
          {Array.from({ length: rows * 7 }).map((_, i) => {
            const date = cellDate(i);
            const isToday = date === TODAY_STR;
            const isPast = date !== null && date < TODAY_STR;
            const appts = date ? (apptByDate[ date ] ?? []) : [];
            const holiday = date ? holidayMap[ date ] : undefined;
            const noRightBorder = (i + 1) % 7 === 0;
            const noBottomBorder = i >= rows * 7 - 7;

            return (
              <div
                key={i}
                onClick={() => {
                  if (date) onSelectDay(date);
                }}
                className={[
                  "cal-cell",
                  !date ? "cal-cell--empty" : "",
                  isToday ? "cal-cell--today" : "",
                  holiday ? "cal-cell--holiday" : "",
                  isPast && !isToday ? "cal-cell--past" : "",
                  noRightBorder ? "cal-cell--no-right-border" : "",
                  noBottomBorder ? "cal-cell--no-bottom-border" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {date && (
                  <>
                    <div
                      className={`cal-day-number${isToday ? " cal-day-number--today" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDrillToDay(date);
                      }}
                      title="Ver día"
                      style={{ cursor: "pointer" }}
                    >
                      {parseInt(date.slice(8))}
                    </div>
                    {holiday && (
                      <div className="cal-holiday-label" title={holiday}>
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
                    <div className="cal-chips">
                      {appts.slice(0, 3).map((a) => (
                        <ApptChip key={a.id} a={a} onViewAppt={onViewAppt} compact />
                      ))}
                      {appts.length > 3 && (
                        <button
                          className="cal-overflow-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDay(date);
                          }}
                        >
                          +{appts.length - 3} más
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
