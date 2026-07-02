"use client";
import { useFetchAppointments } from "@/src/api/useFetchAppointments";
import { useUpdateAppointment } from "@/src/api/useUpdateAppointment";
import { flagUrl } from "@/src/components/CountryCodeInput";
import { AppointmentDrawer } from "@/src/components/Drawers/AppointmentDrawer";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { CancelAppointmentModal } from "@/src/components/Modals/CancelAppointmentModal";
import PageLayout from "@/src/components/PageLayout";
import { ACTION_ICONS } from "@/src/config/icons";
import { PageHeader } from "@/src/components/PageHeader";
import { Appointment, AppointmentStatus } from "@/src/types/Appointment";
import {
  todayFormatedString,
  MONTH_NAMES_ES,
  DAY_NAMES_ES,
  fmtTime,
  fmtDate,
  getColombianHolidays,
  todayString,
  fmtDatePlusOneDay,
} from "@/src/utils/TimeUtils";
import Image from "next/image";
import { useState, useMemo, useEffect, useCallback } from "react";
import { calendarStyles } from "./styles";

type ViewMode = "month" | "week" | "day";

const TODAY_STR = todayFormatedString();

/** Hours shown in week/day views (7 AM – 8 PM) */
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function apptHour(a: Appointment): number {
  return new Date(a.startAt).getHours();
}

export default function CalendarPage() {
  const { updateAppointment } = useUpdateAppointment();

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStart(new Date()),
  );
  const [dayDate, setDayDate] = useState<string>(TODAY_STR);
  const [showCreate, setShowCreate] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [viewAppt, setViewAppt] = useState<Appointment | null>(null);
  const [deleteAppt, setDeleteAppt] = useState<Appointment | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const toStartOfDayISO = (d: Date) => {
    const local = new Date(d);
    local.setHours(0, 0, 0, 0);
    return local.toISOString();
  };

  const toEndOfDayISO = (d: Date) => {
    const local = new Date(d);
    local.setHours(23, 59, 59, 999);
    return local.toISOString();
  };

  const toUtcRangeFromLocalDay = (dateStr: string) => {
    const localStart = new Date(dateStr);
    localStart.setHours(0, 0, 0, 0);
    localStart.setDate(localStart.getDate() + 1);

    const localEnd = new Date(dateStr);
    localEnd.setHours(23, 59, 59, 999);
    localEnd.setDate(localEnd.getDate() + 1);

    return {
      dateFrom: localStart.toISOString(),
      dateTo: localEnd.toISOString(),
    };
  };

  const calendarFilters = useMemo(() => {
    if (viewMode === "month") {
      return {
        dateFrom: toStartOfDayISO(new Date(calYear, calMonth, 1)),
        dateTo: toEndOfDayISO(new Date(calYear, calMonth + 1, 0)),
      };
    }

    if (viewMode === "week") {
      return {
        dateFrom: toStartOfDayISO(weekStart),
        dateTo: toEndOfDayISO(addDays(weekStart, 6)),
      };
    }
    if (viewMode === "day") {
      return toUtcRangeFromLocalDay(dayDate);
    }
    const d = new Date(dayDate);
    return {
      dateFrom: toStartOfDayISO(d),
      dateTo: toEndOfDayISO(d),
    };
  }, [viewMode, calYear, calMonth, weekStart, dayDate]);

  const { appointments, loading, fetchAppointments } =
    useFetchAppointments(calendarFilters);

  const { daysInMonth, startOffset, rows } = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const rows = Math.ceil((startOffset + daysInMonth) / 7);
    return { daysInMonth, startOffset, rows };
  }, [calYear, calMonth]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const sm = MONTH_NAMES_ES[weekStart.getMonth()];
    const em = MONTH_NAMES_ES[end.getMonth()];
    if (weekStart.getMonth() === end.getMonth()) {
      return `${weekStart.getDate()} – ${end.getDate()} ${sm} ${weekStart.getFullYear()}`;
    }
    return `${weekStart.getDate()} ${sm} – ${end.getDate()} ${em} ${end.getFullYear()}`;
  }, [weekStart]);

  const apptByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      const local = new Date(a.startAt);
      const date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
      if (!map[date]) map[date] = [];
      map[date].push(a);
    }
    return map;
  }, [appointments]);

  const holidayMap = useMemo(() => {
    const holidays = getColombianHolidays(calYear);
    const map: Record<string, string> = {};
    for (const h of holidays) map[h.date] = h.name;
    return map;
  }, [calYear]);

  function cellDate(cell: number): string | null {
    const day = cell - startOffset + 1;
    if (day < 1 || day > daysInMonth) return null;
    return `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const prevMonth = useCallback(() => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else setCalMonth((m) => m - 1);
  }, [calMonth]);

  const nextMonth = useCallback(() => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else setCalMonth((m) => m + 1);
  }, [calMonth]);

  const prevWeek = useCallback(() => setWeekStart((d) => addDays(d, -7)), []);
  const nextWeek = useCallback(() => setWeekStart((d) => addDays(d, 7)), []);

  const prevDay = useCallback(
    () => setDayDate((s) => toDateStr(addDays(new Date(s), -1))),
    [],
  );
  const nextDay = useCallback(
    () => setDayDate((s) => toDateStr(addDays(new Date(s), 1))),
    [],
  );

  const goToday = useCallback(() => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setWeekStart(getWeekStart(now));
    setDayDate(TODAY_STR);
  }, []);

  const navPrev = useCallback(() => {
    if (viewMode === "month") prevMonth();
    else if (viewMode === "week") prevWeek();
    else prevDay();
  }, [viewMode, prevMonth, prevWeek, prevDay]);

  const navNext = useCallback(() => {
    if (viewMode === "month") nextMonth();
    else if (viewMode === "week") nextWeek();
    else nextDay();
  }, [viewMode, nextMonth, nextWeek, nextDay]);

  function drillToDay(dateStr: string) {
    console.log("Drilling to day:", dateStr);
    setDayDate(dateStr);
    setViewMode("day");
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowLeft") navPrev();
      if (e.key === "ArrowRight") navNext();
      if (e.key === "m" || e.key === "M") setViewMode("month");
      if (e.key === "w" || e.key === "W") setViewMode("week");
      if (e.key === "d" || e.key === "D") setViewMode("day");
      if (e.key === "t" || e.key === "T") goToday();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navPrev, navNext, goToday]);

  async function handlePay(id: string) {
    try {
      await updateAppointment(id, { paid: true });
    } finally {
      fetchAppointments();
    }
  }

  const selectedDayAppts = selectedDay ? (apptByDate[selectedDay] ?? []) : [];

  const navLabel =
    viewMode === "month"
      ? `${MONTH_NAMES_ES[calMonth]} ${calYear}`
      : viewMode === "week"
        ? weekLabel
        : fmtDatePlusOneDay(dayDate);

  function ApptChip({
    a,
    compact = false,
  }: {
    a: Appointment;
    compact?: boolean;
  }) {
    const isCancelled = a.status === AppointmentStatus.CANCELLED;
    const isNoShow = a.status === AppointmentStatus.NO_SHOW;
    const isCompleted = a.status === AppointmentStatus.COMPLETED;
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setViewAppt(a);
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

  function renderMonthView() {
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
              const appts = date ? (apptByDate[date] ?? []) : [];
              const holiday = date ? holidayMap[date] : undefined;
              const noRightBorder = (i + 1) % 7 === 0;
              const noBottomBorder = i >= rows * 7 - 7;

              return (
                <div
                  key={i}
                  onClick={() => {
                    if (date) setSelectedDay(date);
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
                          drillToDay(date);
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
                          <ApptChip key={a.id} a={a} />
                        ))}
                        {appts.length > 3 && (
                          <button
                            className="cal-overflow-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDay(date);
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

  function renderWeekView() {
    return (
      <div style={{ overflowX: "auto" }}>
        {loading ? (
          <div className="cal-loading">Cargando citas…</div>
        ) : (
          <div style={calendarStyles.weekGrid}>
            <div style={calendarStyles.weekGutter} />
            {weekDays.map((day, di) => {
              const ds = toDateStr(day);
              const isToday = ds === TODAY_STR;
              const holiday = holidayMap[ds];
              const dayAppts = apptByDate[ds] ?? [];
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
                    {DAY_NAMES_ES[di]}
                  </span>
                  <span
                    style={{
                      ...calendarStyles.weekDayNum,
                      ...(isToday ? calendarStyles.weekDayNumToday : {}),
                    }}
                    onClick={() => drillToDay(ds)}
                    title="Ver en vista día"
                  >
                    {day.getDate()}
                  </span>
                  {holiday && (
                    <span
                      title={holiday}
                      style={{ fontSize: 11, opacity: 0.7 }}
                    >
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
            {HOURS.map((hour) => (
              <>
                <div key={`lbl-${hour}`} style={calendarStyles.weekTimeLabel}>
                  {String(hour).padStart(2, "0")}:00
                </div>
                {weekDays.map((day, di) => {
                  const ds = toDateStr(day);
                  const slotAppts = (apptByDate[ds] ?? []).filter(
                    (a) => apptHour(a) === hour,
                  );
                  const isToday = ds === TODAY_STR;
                  return (
                    <div
                      key={`slot-${hour}-${di}`}
                      style={{
                        ...calendarStyles.weekSlot,
                        background: isToday
                          ? "var(--c-primary-50, #eff6ff)"
                          : "var(--c-surface, #fff)",
                      }}
                      onClick={() => {
                        setPrefillDate(ds);
                        setShowCreate(true);
                      }}
                      title={`Nueva cita ${String(hour).padStart(2, "0")}:00`}
                    >
                      {slotAppts.map((a) => (
                        <ApptChip key={a.id} a={a} compact />
                      ))}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderDayView() {
    const dayAppts = apptByDate[dayDate] ?? [];
    const holiday = holidayMap[dayDate];
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
                    onClick={() => {
                      setPrefillDate(dayDate);
                      setShowCreate(true);
                    }}
                    title={`Nueva cita ${String(hour).padStart(2, "0")}:00`}
                  >
                    {slotAppts.map((a) => (
                      <ApptChip key={a.id} a={a} />
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

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Agenda"
          subtitle={todayString()}
          actions={
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary btn-hero"
            >
              Nueva Cita
            </button>
          }
        />
        <div className="table-card">
          <div className="cal-nav-header">
            <button
              onClick={navPrev}
              className="btn-secondary"
              style={{ padding: "7px 14px", fontSize: 16 }}
            >
              &#8249;
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span className="cal-month-label">{navLabel}</span>
              <button
                onClick={goToday}
                className="btn-secondary btn-secondary--sm"
              >
                Hoy
              </button>
              <div style={calendarStyles.viewToggle}>
                {(["month", "week", "day"] as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setViewMode(v)}
                    style={{
                      ...calendarStyles.viewToggleBtn,
                      ...(viewMode === v
                        ? calendarStyles.viewToggleBtnActive
                        : {}),
                    }}
                    title={
                      v === "month"
                        ? "Vista mensual (M)"
                        : v === "week"
                          ? "Vista semanal (W)"
                          : "Vista diaria (D)"
                    }
                  >
                    {v === "month" ? "Mes" : v === "week" ? "Semana" : "Día"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={navNext}
              className="btn-secondary"
              style={{ padding: "7px 14px", fontSize: 16 }}
            >
              &#8250;
            </button>
          </div>
          {viewMode === "month" && renderMonthView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "day" && renderDayView()}
        </div>
      </PageLayout>

      {selectedDay && viewMode === "month" && (
        <div
          className="cal-day-panel-overlay"
          onClick={() => setSelectedDay(null)}
        >
          <div className="cal-day-panel" onClick={(e) => e.stopPropagation()}>
            <div className="cal-day-panel__header">
              <span className="cal-day-panel__title">
                {fmtDate(selectedDay)}
              </span>
              <button
                className="btn-close"
                onClick={() => setSelectedDay(null)}
              >
                <ACTION_ICONS.close size={16} />
              </button>
            </div>
            {selectedDayAppts.length === 0 ? (
              <p className="cal-day-panel__empty">
                No hay citas para este día.
              </p>
            ) : (
              <div className="cal-day-panel__appt-list">
                {selectedDayAppts.map((a) => (
                  <div
                    key={a.id}
                    className="cal-day-panel__appt-item"
                    onClick={() => {
                      setViewAppt(a);
                      setSelectedDay(null);
                    }}
                  >
                    <div
                      className="cal-day-panel__appt-dot"
                      style={{
                        background:
                          a.appointmentLocation.color ?? "var(--c-gray-400)",
                      }}
                    />
                    <span className="cal-day-panel__appt-name">
                      {a.patient.name} {a.patient.lastName}
                    </span>
                    <span className="cal-day-panel__appt-time">
                      {fmtTime(a.startAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-secondary btn-secondary--sm"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => {
                  drillToDay(selectedDay);
                  setSelectedDay(null);
                }}
              >
                Ver día
              </button>
              <button
                className="btn-primary btn-hero"
                style={{ flex: 2, justifyContent: "center" }}
                onClick={() => {
                  setPrefillDate(selectedDay);
                  setSelectedDay(null);
                  setShowCreate(true);
                }}
              >
                Nueva Cita
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreate && (
        <AppointmentModal
          appt={undefined}
          prefillDate={prefillDate}
          onClose={() => {
            setShowCreate(false);
            setPrefillDate(null);
          }}
          onSaved={fetchAppointments}
        />
      )}
      {editAppt && (
        <AppointmentModal
          appt={editAppt}
          onClose={() => setEditAppt(null)}
          onSaved={fetchAppointments}
        />
      )}
      {viewAppt && !editAppt && !deleteAppt && (
        <AppointmentDrawer
          appt={viewAppt}
          onClose={() => setViewAppt(null)}
          onEdit={() => {
            setEditAppt(viewAppt);
            setViewAppt(null);
          }}
          onPay={() => {
            handlePay(viewAppt.id);
            setViewAppt(null);
          }}
          onDelete={() => {
            setDeleteAppt(viewAppt);
            setViewAppt(null);
          }}
        />
      )}
      {deleteAppt && (
        <CancelAppointmentModal
          appt={deleteAppt}
          onClose={() => setDeleteAppt(null)}
          onCanceled={fetchAppointments}
        />
      )}
    </>
  );
}
