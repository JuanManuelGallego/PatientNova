"use client";

import { useRef, type CSSProperties, type TouchEvent } from "react";
import Image from "next/image";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { flagUrl } from "@/src/components/CountryCodeInput";
import { AppointmentStatusPill } from "@/src/components/Info/StatusPill";
import { Appointment, AppointmentStatus } from "@/src/types/Appointment";
import { BlockedTime } from "@/src/types/BlockedTime";
import {
  MONTH_NAMES_ES, fmtCalendarDay, fmtMonthLabel, fmtTime, localDateTimeToUtc, nextCalendarDay, todayFormattedString, zonedDateTimeParts,
} from "@/src/utils/TimeUtils";
import { DAY_NAMES_ES, weekOf, type HeldSlot } from "./constants";
import { HOLD_LABEL } from "./PendingHold";
import { ViewMode } from "./types";
import styles from "./Agenda.module.css";

const fmtWeekday = (day: string) => fmtCalendarDay(day, { weekday: true, year: false });

const shortMonth = (day: string) => MONTH_NAMES_ES[ Number(day.slice(5, 7)) - 1 ]!.slice(0, 3).toLowerCase();

export function agendaPeriodLabel(day: string): string {
  const week = weekOf(day);
  const first = week[ 0 ]!;
  const last = week[ 6 ]!;
  const firstYear = first.slice(0, 4);
  const lastYear = last.slice(0, 4);
  if (first.slice(0, 7) === last.slice(0, 7)) return fmtMonthLabel(Number(first.slice(5, 7)) - 1, Number(firstYear));
  if (firstYear === lastYear) return `${shortMonth(first)} – ${shortMonth(last)} ${lastYear}`;
  return `${shortMonth(first)} ${firstYear} – ${shortMonth(last)} ${lastYear}`;
}

type DayPart = "allDay" | "range" | "startsHere" | "endsHere";

function dayPart(startIso: string, endIso: string, day: string, timezone: string): DayPart {
  const start = zonedDateTimeParts(startIso, timezone);
  const end = zonedDateTimeParts(endIso, timezone);
  const next = nextCalendarDay(day);
  const startsBefore = start.dateStr < day;
  const startsAtMidnight = start.dateStr === day && start.hour === 0 && start.minute === 0;
  const endsAtNextMidnight = end.dateStr === next && end.hour === 0 && end.minute === 0;
  const endsAfter = end.dateStr > next || (end.dateStr === next && !endsAtNextMidnight);
  if ((startsBefore || startsAtMidnight) && (endsAfter || endsAtNextMidnight)) return "allDay";
  if (startsBefore) return "endsHere";
  if (endsAfter) return "startsHere";
  return "range";
}

type Entry =
  | { kind: "appt"; id: string; start: string; end: string; appt: Appointment }
  | { kind: "hold"; id: string; start: string; end: string; hold: HeldSlot }
  | { kind: "blocked"; id: string; start: string; end: string; blocked: BlockedTime };

interface DayEvents {
  apptByDate: Record<string, Appointment[]>;
  blockedByDate: Record<string, BlockedTime[]>;
  holdByDate?: Record<string, HeldSlot[]>;
}

function dayEntries(day: string, { apptByDate, blockedByDate, holdByDate }: DayEvents): Entry[] {
  const entries: Entry[] = [
    ...(apptByDate[ day ] ?? []).map((a): Entry => ({ kind: "appt", id: a.id, start: a.startAt, end: a.endAt, appt: a })),
    ...(holdByDate?.[ day ] ?? []).map((h): Entry => ({ kind: "hold", id: h.id, start: h.startAt, end: h.endAt, hold: h })),
    ...(blockedByDate[ day ] ?? []).map((bt): Entry => ({ kind: "blocked", id: bt.id, start: bt.startTimeUtc, end: bt.endTimeUtc, blocked: bt })),
  ];
  return entries.sort((x, y) => Date.parse(x.start) - Date.parse(y.start));
}

function eventCount(day: string, events: DayEvents): number {
  return (events.apptByDate[ day ]?.length ?? 0)
    + (events.blockedByDate[ day ]?.length ?? 0)
    + (events.holdByDate?.[ day ]?.length ?? 0);
}

const countLabel = (n: number) => (n === 0 ? "sin eventos" : `${n} ${n === 1 ? "evento" : "eventos"}`);

function HolidayFlag() {
  return <Image className="phone-input-flag" src={flagUrl("co")} alt="Colombia" width={20} height={15} />;
}

interface AgendaToolbarProps {
  label: string;
  view: ViewMode.Day | ViewMode.Month;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onChangeView: (v: ViewMode) => void;
}

const PHONE_VIEWS = [
  { view: ViewMode.Day, label: "Día", testId: "calendar-view-day-button" },
  { view: ViewMode.Month, label: "Mes", testId: "calendar-view-month-button" },
] as const;

export function AgendaToolbar({ label, view, onPrev, onNext, onToday, onChangeView }: AgendaToolbarProps) {
  const unit = view === ViewMode.Month ? "Mes" : "Semana";
  return (
    <div className={styles.toolbar}>
      <div className={styles.period}>
        <button type="button" className={styles.iconButton} onClick={onPrev} aria-label={`${unit} anterior`} data-testid="calendar-nav-prev-button">
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <span className={styles.periodLabel} aria-live="polite">{label}</span>
        <button type="button" className={styles.iconButton} onClick={onNext} aria-label={`${unit} siguiente`} data-testid="calendar-nav-next-button">
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.todayButton} onClick={onToday} data-testid="calendar-today-button">
          Hoy
        </button>
        <div className={styles.segmented} role="group" aria-label="Vista">
          {PHONE_VIEWS.map((v) => (
            <button
              key={v.view}
              type="button"
              className={styles.segment}
              aria-pressed={view === v.view}
              onClick={() => onChangeView(v.view)}
              data-testid={v.testId}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AgendaProps extends DayEvents {
  timezone: string;
  day: string;
  holidayMap: Record<string, string>;
  loading: boolean;
  onSelectDay: (day: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onViewAppt: (a: Appointment) => void;
  onSelectBlockedTime: (bt: BlockedTime) => void;
  onSelectHold?: (id: string) => void;
  onCreateAppointment: (startIso: string) => void;
  onCreateBlockedTime: (day: string) => void;
}

const SWIPE_MIN_PX = 48;

export function Agenda(props: AgendaProps) {
  const { timezone, day, holidayMap, loading, onSelectDay, onPrevWeek, onNextWeek, onSelectHold } = props;
  const events: DayEvents = {
    apptByDate: props.apptByDate,
    blockedByDate: props.blockedByDate,
    holdByDate: onSelectHold ? props.holdByDate : undefined,
  };
  const today = todayFormattedString(timezone);
  const week = weekOf(day);
  const entries = dayEntries(day, events);
  const holiday = holidayMap[ day ];

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[ 0 ];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const from = touchStart.current;
    const t = e.changedTouches[ 0 ];
    touchStart.current = null;
    if (!from || !t) return;
    const dx = t.clientX - from.x;
    const dy = t.clientY - from.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) onNextWeek();
    else onPrevWeek();
  };

  return (
    <section className={styles.agenda} aria-label="Agenda">
      <div
        className={styles.strip}
        role="group"
        aria-label={`Semana del ${fmtCalendarDay(week[ 0 ]!, { weekday: true })}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {week.map((d, i) => {
          const count = eventCount(d, events);
          return (
            <button
              key={d}
              type="button"
              className={styles.pill}
              aria-pressed={d === day}
              aria-current={d === today ? "date" : undefined}
              aria-label={`${fmtWeekday(d)}, ${countLabel(count)}${holidayMap[ d ] ? `, festivo` : ""}`}
              data-past={d < today || undefined}
              data-holiday={holidayMap[ d ] ? true : undefined}
              onClick={() => onSelectDay(d)}
              data-testid={`calendar-strip-day-${d}`}
            >
              <span className={styles.pillWeekday}>{DAY_NAMES_ES[ i ]}</span>
              <span className={styles.pillNumber}>{Number(d.slice(8))}</span>
              <span className={styles.dotSlot}>
                {count > 0 && <span className={styles.dot} data-testid="calendar-strip-dot" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.dayHeader}>
        <h2 className={styles.dayTitle}>{fmtWeekday(day)}</h2>
        {day === today && <span className={styles.todayTag}>Hoy</span>}
      </div>
      {holiday && (
        <p className={styles.holiday} data-testid="calendar-agenda-holiday">
          <HolidayFlag /> {holiday}
        </p>
      )}

      <div className={styles.list} aria-busy={loading} data-loading={loading || undefined} data-testid="calendar-agenda-list">
        {loading && entries.length === 0 && <p className={styles.loadingText}>Cargando citas…</p>}
        {entries.map((entry) => <AgendaItem key={`${entry.kind}-${entry.id}`} {...props} entry={entry} />)}
        {!loading && entries.length === 0 && (
          <div className={styles.empty} data-testid="calendar-agenda-empty">
            <CalendarPlus className={styles.emptyIcon} size={28} aria-hidden="true" />
            <p className={styles.emptyTitle}>No hay citas este día</p>
            <div className={styles.emptyActions}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => props.onCreateBlockedTime(day)}
                data-testid="calendar-agenda-block-time"
              >
                Bloquear horario
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => props.onCreateAppointment(localDateTimeToUtc(day, "09:00:00", timezone))}
                data-testid="calendar-agenda-new-appointment"
              >
                Nueva cita
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AgendaItem({ entry, day, timezone, onViewAppt, onSelectBlockedTime, onSelectHold }: AgendaProps & { entry: Entry }) {
  const part = dayPart(entry.start, entry.end, day, timezone);
  const time = {
    allDay: <span className={styles.timeStart}>Todo el día</span>,
    endsHere: <span className={styles.timeStart}>Hasta {fmtTime(entry.end, timezone)}</span>,
    startsHere: (
      <>
        <span className={styles.timeStart}>{fmtTime(entry.start, timezone)}</span>
        <span className={styles.timeEnd}>…</span>
      </>
    ),
    range: (
      <>
        <span className={styles.timeStart}>{fmtTime(entry.start, timezone)}</span>
        <span className={styles.timeEnd}>{fmtTime(entry.end, timezone)}</span>
      </>
    ),
  }[ part ];

  if (entry.kind === "appt") {
    const a = entry.appt;
    const rail = { "--rail": a.appointmentLocation?.color ?? "var(--c-brand)" } as CSSProperties;
    return (
      <button
        type="button"
        className={styles.item}
        style={rail}
        data-completed={a.status === AppointmentStatus.COMPLETED || undefined}
        onClick={() => onViewAppt(a)}
        data-testid={`calendar-agenda-event-${a.id}`}
      >
        <span className={styles.time}>{time}</span>
        <span className={styles.body}>
          <span className={styles.title}>{a.patient.name} {a.patient.lastName}</span>
          {a.appointmentType?.name && <span className={styles.meta}>{a.appointmentType.name}</span>}
          <span className={styles.statusLine}>
            <AppointmentStatusPill status={a.status} />
            {a.appointmentLocation?.name && <span className={styles.meta}>{a.appointmentLocation.name}</span>}
          </span>
        </span>
      </button>
    );
  }

  if (entry.kind === "hold") {
    const h = entry.hold;
    return (
      <button
        type="button"
        className={`${styles.item} ${styles.hold} cal-hold`}
        onClick={() => onSelectHold?.(h.id)}
        data-testid={`calendar-agenda-hold-${h.id}`}
      >
        <span className={styles.time}>{time}</span>
        <span className={styles.body}>
          <span className={styles.title}>{HOLD_LABEL}</span>
          <span className={styles.meta}>{h.name} {h.lastName}</span>
        </span>
      </button>
    );
  }

  const bt = entry.blocked;
  return (
    <button
      type="button"
      className={`${styles.item} ${styles.blocked}`}
      onClick={() => onSelectBlockedTime(bt)}
      data-testid={`calendar-agenda-blocked-${bt.id}`}
    >
      <span className={styles.time}>{time}</span>
      <span className={styles.body}>
        <span className={styles.title}>Horario bloqueado</span>
        {bt.description && <span className={styles.meta}>{bt.description}</span>}
      </span>
    </button>
  );
}

interface CompactMonthProps extends DayEvents {
  timezone: string;
  year: number;
  month: number;
  selectedDay: string;
  holidayMap: Record<string, string>;
  loading: boolean;
  onSelectDay: (day: string) => void;
}

export function CompactMonth({ timezone, year, month, selectedDay, holidayMap, loading, onSelectDay, ...events }: CompactMonthProps) {
  const today = todayFormattedString(timezone);
  const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth }, (_, i) => `${first.slice(0, 8)}${String(i + 1).padStart(2, "0")}`);
  const monthLabel = fmtMonthLabel(month, year);

  return (
    <div className={styles.month} data-loading={loading || undefined} aria-busy={loading}>
      <div className={styles.monthWeekdays} aria-hidden="true">
        {DAY_NAMES_ES.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className={styles.monthGrid} role="group" aria-label={monthLabel}>
        {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} data-blank />)}
        {days.map((d) => {
          const count = eventCount(d, events);
          const holiday = holidayMap[ d ];
          return (
            <button
              key={d}
              type="button"
              className={styles.monthDay}
              aria-pressed={d === selectedDay}
              aria-current={d === today ? "date" : undefined}
              aria-label={`${fmtWeekday(d)}, ${countLabel(count)}${holiday ? `, ${holiday}` : ""}`}
              data-past={d < today || undefined}
              data-holiday={holiday ? true : undefined}
              onClick={() => onSelectDay(d)}
              data-testid={`calendar-month-day-${d}`}
            >
              <span className={styles.monthNumber}>{Number(d.slice(8))}</span>
              <span className={styles.dotSlot}>
                {count > 0 && <span className={styles.dot} data-testid="calendar-month-dot" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
