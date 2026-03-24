import { AppointmentDuration } from "../types/Appointment";
import { REMINDER_TYPE_CONFIG, ReminderType } from "../types/Reminder";

function fmtDateTime(iso: string | undefined): string {
    if (!iso) return "Invalid Date"
    return new Date(iso).toLocaleString("es-ES", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

function fmtDateAndTime(d: string): string {
    if (!d) return "Invalid Date"

    return new Date(d).toLocaleString("es-ES", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

function fmtDate(d: string | undefined): string {
    if (!d) return "Invalid Date"

    return new Date(d).toLocaleDateString("es-ES", {
        day: "numeric", month: "long", year: "numeric",
    });
}

function fmtTime(d: string | undefined): string {
    if (!d) return "Invalid Date"
    return new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateWeekDay(d: string | undefined): string {
    if (!d) return "Invalid Date"
    return new Date(d).toLocaleDateString("es-ES", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
}


function isoToLocal(iso: string): string {
    const date = new Date(iso);
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function fmtRelative(d: string | undefined): string {
    if (!d) return "Invalid Date"
    const diff = new Date(d).getTime() - Date.now();
    const abs = Math.abs(diff);
    if (abs < 60_000) return "Ahora mismo";
    if (abs < 3_600_000) return `${Math.round(abs / 60_000)} min`;
    if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)} h`;
    return `${Math.round(abs / 86_400_000)} días`;
}

function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTH_NAMES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAY_NAMES_ES = [ "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom" ];


function isReminderTypeFeasible(date: string, reminderType: ReminderType): boolean {
    if (reminderType === ReminderType.NONE) return true;
    if (!date) return false;

    const now = new Date();
    const timeUntilAppointment = new Date(date).getTime() - now.getTime();

    const requiredTime = REMINDER_TYPE_CONFIG[ reminderType ].offsetMs;
    return timeUntilAppointment > requiredTime;
}


function getRemindersendAt(date: string, reminderType: ReminderType): string {
    switch (reminderType) {
        case ReminderType.ONE_HOUR_BEFORE:
            return new Date(new Date(date).getTime() - REMINDER_TYPE_CONFIG[ ReminderType.ONE_HOUR_BEFORE ].offsetMs).toISOString();
        case ReminderType.ONE_DAY_BEFORE:
            return new Date(new Date(date).getTime() - REMINDER_TYPE_CONFIG[ ReminderType.ONE_DAY_BEFORE ].offsetMs).toISOString();
        case ReminderType.ONE_WEEK_BEFORE:
            return new Date(new Date(date).getTime() - REMINDER_TYPE_CONFIG[ ReminderType.ONE_WEEK_BEFORE ].offsetMs).toISOString();
        default:
            return date;
    }
}

function formatDate(d: string): string {
    return new Date(d).toLocaleDateString("es-ES", {
        day: "numeric", month: "long", year: "numeric",
    });
}

function formatTime(d: string): string {
    return new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
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

function getTommorrowSixAm(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);
    return tomorrow.toISOString();
}

function getDate(date: string): string {
    return date.slice(0, 10);
}

function getReminderType(startAt: string, sendAt: string): ReminderType {
    const diff = (new Date(startAt).getTime() - new Date(sendAt).getTime());
    if (diff === REMINDER_TYPE_CONFIG[ ReminderType.ONE_HOUR_BEFORE ].offsetMs) return ReminderType.ONE_HOUR_BEFORE;
    if (diff === REMINDER_TYPE_CONFIG[ ReminderType.ONE_DAY_BEFORE ].offsetMs) return ReminderType.ONE_DAY_BEFORE;
    if (diff === REMINDER_TYPE_CONFIG[ ReminderType.ONE_WEEK_BEFORE ].offsetMs) return ReminderType.ONE_WEEK_BEFORE;
    return ReminderType.NONE;
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

export {
    fmtDate,
    fmtTime,
    fmtDateAndTime,
    fmtDateTime,
    fmtDateWeekDay,
    fmtRelative,
    formatDate,
    formatTime,
    getDate,
    getAppointmentEndTime,
    getDuration,
    getRemindersendAt,
    getReminderType,
    getTommorrowSixAm,
    isoToLocal,
    isReminderTypeFeasible,
    today,
    getColombianHolidays,
    MONTH_NAMES_ES,
    DAY_NAMES_ES,
};

export type { ColombianHoliday };
