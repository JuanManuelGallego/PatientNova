import { AppointmentDuration } from "@/src/types/Appointment";
import { REMINDER_TYPE_CONFIG, RELATIVE_REMINDER_TYPES, CLOCK_REMINDER_TYPES, ReminderType } from "@/src/types/Reminder";

/*
 * Provider-side times are shown in the provider's timezone (`user.timezone`), not the browser's, so the
 * Portal agrees with the server (reminders, day filters) wherever the provider's device happens to be.
 * AuthContext sets it whenever the user loads or changes; every helper below defaults to it, and an explicit
 * `timezone` argument overrides it. Until it is set (login page, unit tests) the browser's zone is used.
 */
let displayTimezone: string | undefined;

function setDisplayTimezone(timezone: string | null | undefined): void {
    displayTimezone = timezone || undefined;
}

function browserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getDisplayTimezone(): string {
    return displayTimezone ?? browserTimezone();
}

/** Short label for a timezone, e.g. "Bogota (GMT-5)". */
function fmtTimezoneLabel(timezone: string = getDisplayTimezone()): string {
    const city = timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;
    const offset = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value;
    return offset ? `${city} (${offset})` : city;
}

function fmtTimestamp(iso: string | undefined, timezone?: string): string {
    if (!iso) return "Invalid Date"
    return new Date(iso).toLocaleString("es-ES", {
        timeZone: timezone ?? getDisplayTimezone(),
        day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hour12: true, second: "numeric",
    });
}

function fmtDateTime(iso: string | undefined, timezone?: string): string {
    if (!iso) return "Invalid Date"
    return new Date(iso).toLocaleString("es-ES", {
        timeZone: timezone ?? getDisplayTimezone(),
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true
    });
}

const fmtDatePlusOneHour = (isoStr: string): string => {
  const date = new Date(isoStr);
  date.setTime(date.getTime() + 60 * 60 * 1000);
  return date.toISOString();
};

function fmtDate(d: string | undefined, timezone?: string): string {
    if (!d) return "Invalid Date"

    return new Date(toInstant(d, timezone)).toLocaleDateString("es-ES", {
        timeZone: timezone ?? getDisplayTimezone(),
        day: "numeric", month: "long", year: "numeric",
    });
}

function fmtDatePlusOneDay(d: string | undefined, timezone?: string): string {
    if (!d) return "Invalid Date"

    const [ y, m, day ] = todayFormattedString(timezone, new Date(toInstant(d, timezone))).split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, day + 1, 12));

    return next.toLocaleDateString("es-ES", {
        timeZone: "UTC",
        day: "numeric", month: "long", year: "numeric",
    });
}

function fmtTime(d: string | undefined, timezone?: string): string {
    if (!d) return "Invalid Date"
    return new Date(d).toLocaleTimeString("es-ES", {
        timeZone: timezone ?? getDisplayTimezone(),
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

/** Computes age in whole years from an ISO birth date. Returns null if invalid. */
function getAge(birthDate: string | undefined | null): number | null {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
}

function fmtDateWeekDay(d: string | undefined, timezone?: string): string {
    if (!d) return "Invalid Date"
    return new Date(toInstant(d, timezone)).toLocaleDateString("es-ES", {
        timeZone: timezone ?? getDisplayTimezone(),
        weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
}


/** UTC instant as a wall-clock "YYYY-MM-DDTHH:mm" string in the display timezone. */
function isoToLocal(iso: string, timezone?: string): string {
    return toWallClock(iso, timezone).slice(0, 16);
}

function fmtRelative(d: string | undefined): string {
    if (!d) return "Invalid Date"
    const diff = new Date(d).getTime() - Date.now();
    const abs = Math.abs(diff);
    if (abs < 60_000) return "Ahora mismo";
    if (abs < 3_600_000) return `${Math.round(abs / 60_000)} min`;
    if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)} h`;
    const days = Math.round(abs / 86_400_000);
    return days === 1 ? "1 día" : `${days} días`;
}

/** Today as YYYY-MM-DD in the display timezone. */
function today(timezone?: string): string {
    return todayFormattedString(timezone);
}

function todayString(timezone?: string): string {
    return new Date().toLocaleDateString("es-ES", {
        timeZone: timezone ?? getDisplayTimezone(),
        weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
}

function todayFormattedString(timezone?: string, at: Date = new Date()): string {
    return zonedDateTimeParts(at, timezone).dateStr;
}

const zonedFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(timezone: string): Intl.DateTimeFormat {
    let formatter = zonedFormatters.get(timezone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23",
        });
        zonedFormatters.set(timezone, formatter);
    }
    return formatter;
}

/** Wall-clock date (YYYY-MM-DD), hour, minute and second of an instant in `timezone` (display zone if omitted). */
function zonedDateTimeParts(
    at: Date | string,
    timezone?: string,
): { dateStr: string; hour: number; minute: number; second: number } {
    const parts = zonedFormatter(timezone ?? getDisplayTimezone()).formatToParts(new Date(at));
    const values = Object.fromEntries(parts.map(({ type, value }) => [ type, value ]));
    return {
        dateStr: `${values.year}-${values.month}-${values.day}`,
        hour: Number(values.hour),
        minute: Number(values.minute),
        second: Number(values.second),
    };
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Wall-clock "YYYY-MM-DDTHH:mm:ss" of a value in the display timezone. A date-only "YYYY-MM-DD" is already a
 * wall date and is returned at midnight. Used to feed antd/dayjs pickers, which only work in the browser zone.
 */
function toWallClock(value: string | Date, timezone?: string): string {
    if (typeof value === "string" && DATE_ONLY.test(value)) return `${value}T00:00:00`;
    const { dateStr, hour, minute, second } = zonedDateTimeParts(value, timezone);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${dateStr}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/** Inverse of `toWallClock`: a wall-clock "YYYY-MM-DDTHH:mm[:ss]" in the display timezone to a UTC ISO string. */
function fromWallClock(wall: string, timezone?: string): string {
    const [ dateStr, time = "00:00:00" ] = wall.split("T");
    return localDateTimeToUtc(dateStr, time.length === 5 ? `${time}:00` : time, timezone ?? getDisplayTimezone());
}

/** A date-only "YYYY-MM-DD" means midnight in the display timezone; anything else is already an instant. */
function toInstant(value: string, timezone?: string): string {
    return DATE_ONLY.test(value) ? fromWallClock(value, timezone) : value;
}

const MONTH_NAMES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAY_NAMES_ES = [ "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom" ];


/** Converts a wall-clock date/time in `timezone` to a UTC ISO string. */
function localDateTimeToUtc(dateStr: string, time: string, timezone: string = getDisplayTimezone()): string {
  const target = Date.parse(`${dateStr}T${time}Z`);
  const milliseconds = target % 1000;
  const wallTime = target - milliseconds;
  let utc = wallTime;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utc)).map(({ type, value }) => [ type, value ]),
    );
    const localAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    utc += wallTime - localAsUtc;
  }

  return new Date(utc + milliseconds).toISOString();
}

function isReminderTypeFeasible(date: string, reminderType: ReminderType, timezone?: string): boolean {
    if (reminderType === ReminderType.NONE || reminderType === ReminderType.IMMEDIATE || reminderType === ReminderType.MANUAL) return true;
    if (!date) return false;

    const start = new Date(date).getTime();
    const sendAt = new Date(getReminderSendAt(date, reminderType, timezone)).getTime();
    // Must still be in the future and go out before the appointment starts.
    return sendAt > Date.now() && sendAt < start;
}


function getReminderSendAt(date: string, reminderType: ReminderType, timezone?: string): string {
    if (RELATIVE_REMINDER_TYPES.includes(reminderType)) {
        return new Date(new Date(date).getTime() - REMINDER_TYPE_CONFIG[ reminderType ].offsetMs).toISOString();
    }
    const clock = REMINDER_TYPE_CONFIG[ reminderType ].clock;
    if (clock) {
        // Clock times are wall-clock times in the user's timezone, not the browser's.
        const tz = timezone ?? getDisplayTimezone();
        const [y, m, day] = todayFormattedString(tz, new Date(date)).split("-").map(Number);
        const target = new Date(Date.UTC(y, m - 1, day - clock.daysBefore)).toISOString().slice(0, 10);
        const hh = String(clock.hour).padStart(2, "0");
        const mm = String(clock.minute).padStart(2, "0");
        return localDateTimeToUtc(target, `${hh}:${mm}:00.000`, tz);
    }
    return date;
}


function getDuration(startAt: string | undefined, endAt: string | undefined): AppointmentDuration {
    if (!startAt || !endAt) return AppointmentDuration.MIN_60; //default

    const diff = (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000;
    if (diff === 45) return AppointmentDuration.MIN_45;
    if (diff === 50) return AppointmentDuration.MIN_50;
    if (diff === 60) return AppointmentDuration.MIN_60;
    if (diff === 90) return AppointmentDuration.MIN_90;

    return AppointmentDuration.MIN_60; //default
}

function getAppointmentEndTime(startAt: string, duration: AppointmentDuration): string {
    const start = new Date(startAt);
    const dur = duration === AppointmentDuration.MIN_45 ? 45 : duration === AppointmentDuration.MIN_50 ? 50 : duration === AppointmentDuration.MIN_60 ? 60 : 90;
    return new Date(start.getTime() + dur * 60000).toISOString();
}

/** 06:00 tomorrow in the display timezone. */
function getTomorrowSixAm(timezone?: string): string {
    const [ y, m, d ] = todayFormattedString(timezone).split("-").map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    return localDateTimeToUtc(tomorrow, "06:00:00", timezone ?? getDisplayTimezone());
}

function getDate(date: string): string {
    return date.slice(0, 10);
}

function getReminderType(startAt: string, sendAt: string, timezone?: string): ReminderType {
    const diff = (new Date(startAt).getTime() - new Date(sendAt).getTime());
    const preset = RELATIVE_REMINDER_TYPES.find((t) => REMINDER_TYPE_CONFIG[ t ].offsetMs === diff);
    const clockPreset = CLOCK_REMINDER_TYPES.find((t) => getReminderSendAt(startAt, t, timezone) === new Date(sendAt).toISOString());
    if (clockPreset) return clockPreset;
    return preset ?? ReminderType.MANUAL;
}

function easterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
}

function nextMonday(date: Date): Date {
    const d = new Date(date);
    const dow = d.getDay();
    if (dow === 1) return d;
    const diff = dow === 0 ? 1 : 8 - dow;
    d.setDate(d.getDate() + diff);
    return d;
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function dateToStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface ColombianHoliday { date: string; name: string; }

function getColombianHolidays(year: number): ColombianHoliday[] {
    const easter = easterSunday(year);
    const fixed: [ number, number, string ][] = [
        [ 0, 1, "Año Nuevo" ],
        [ 4, 1, "Día del Trabajo" ],
        [ 6, 20, "Día de la Independencia" ],
        [ 7, 7, "Batalla de Boyacá" ],
        [ 11, 8, "Inmaculada Concepción" ],
        [ 11, 25, "Navidad" ],
    ];
    const emiliani: [ number, number, string ][] = [
        [ 0, 6, "Día de los Reyes Magos" ],
        [ 2, 19, "Día de San José" ],
        [ 5, 29, "San Pedro y San Pablo" ],
        [ 7, 15, "Asunción de la Virgen" ],
        [ 9, 12, "Día de la Raza" ],
        [ 10, 1, "Todos los Santos" ],
        [ 10, 11, "Independencia de Cartagena" ],
    ];
    const easterBased: [ number, string, boolean ][] = [
        [ -3, "Jueves Santo", false ],
        [ -2, "Viernes Santo", false ],
        [ 43, "Ascensión del Señor", true ],
        [ 64, "Corpus Christi", true ],
        [ 71, "Sagrado Corazón", true ],
    ];

    const holidays: ColombianHoliday[] = [];

    for (const [ m, d, name ] of fixed) {
        holidays.push({ date: dateToStr(new Date(year, m, d)), name });
    }
    for (const [ m, d, name ] of emiliani) {
        holidays.push({ date: dateToStr(nextMonday(new Date(year, m, d))), name });
    }
    for (const [ offset, name, toMonday ] of easterBased) {
        const d = addDays(easter, offset);
        holidays.push({ date: dateToStr(toMonday ? nextMonday(d) : d), name });
    }

    return holidays;
}

const COMMON_TIMEZONES: { value: string; label: string }[] = [
    { value: "America/Bogota", label: "Colombia (UTC-5) — Bogotá" },
    { value: "America/Lima", label: "Perú (UTC-5) — Lima" },
    { value: "America/Guayaquil", label: "Ecuador (UTC-5) — Quito" },
    { value: "America/Caracas", label: "Venezuela (UTC-4) — Caracas" },
    { value: "America/La_Paz", label: "Bolivia (UTC-4) — La Paz" },
    { value: "America/Santiago", label: "Chile (UTC-4/-3) — Santiago" },
    { value: "America/Sao_Paulo", label: "Brasil (UTC-3) — São Paulo" },
    { value: "America/Argentina/Buenos_Aires", label: "Argentina (UTC-3) — Buenos Aires" },
    { value: "America/Mexico_City", label: "México (UTC-6/-5) — Ciudad de México" },
    { value: "America/New_York", label: "Eastern Time (UTC-5/-4) — Nueva York" },
    { value: "America/Chicago", label: "Central Time (UTC-6/-5) — Chicago" },
    { value: "America/Denver", label: "Mountain Time (UTC-7/-6) — Denver" },
    { value: "America/Los_Angeles", label: "Pacific Time (UTC-8/-7) — Los Ángeles" },
    { value: "Europe/Madrid", label: "España (UTC+1/+2) — Madrid" },
    { value: "Europe/London", label: "Reino Unido (UTC+0/+1) — Londres" },
    { value: "UTC", label: "UTC (UTC+0)" },
];

enum RelativeTime {
    UPCOMING = "upcoming",
    PAST = "past",
    ALL = "all"
}

function fmtSendTime(startAt: string, type: ReminderType, timezone?: string): string {
  if (!startAt) return "";
  return new Date(getReminderSendAt(startAt, type, timezone)).toLocaleString("es-ES", {
    timeZone: timezone,
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export {
    addDays,
    fmtDate,
    fmtTime,
    fmtDateTime,
    fmtDateWeekDay,
    fmtDatePlusOneDay,
    fmtDatePlusOneHour,
    fmtRelative,
    fmtTimestamp,
    fmtSendTime,
    localDateTimeToUtc,
    getDate,
    getAppointmentEndTime,
    getDuration,
    getReminderSendAt,
    getReminderType,
    getTomorrowSixAm,
    isoToLocal,
    isReminderTypeFeasible,
    today,
    todayString,
    todayFormattedString,
    zonedDateTimeParts,
    toWallClock,
    fromWallClock,
    setDisplayTimezone,
    getDisplayTimezone,
    browserTimezone,
    fmtTimezoneLabel,
    getColombianHolidays,
    getAge,
    MONTH_NAMES_ES,
    DAY_NAMES_ES,
    COMMON_TIMEZONES,
    RelativeTime,
};

export type { ColombianHoliday };
