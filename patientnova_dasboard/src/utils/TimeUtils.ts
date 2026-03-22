import { AppointmentDuration } from "../types/Appointment";
import { ReminderType } from "../types/Reminder";

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
    return new Date().toISOString().slice(0, 10);
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

    const reminderOffsets: Record<ReminderType, number> = {
        [ ReminderType.ONE_HOUR_BEFORE ]: 60 * 60 * 1000,
        [ ReminderType.ONE_DAY_BEFORE ]: 24 * 60 * 60 * 1000,
        [ ReminderType.ONE_WEEK_BEFORE ]: 7 * 24 * 60 * 60 * 1000,
        [ ReminderType.NONE ]: 0,
    };

    const requiredTime = reminderOffsets[ reminderType ];
    return timeUntilAppointment > requiredTime;
}


function getRemindersendAt(date: string, reminderType: ReminderType): string {
    switch (reminderType) {
        case ReminderType.ONE_HOUR_BEFORE:
            return new Date(new Date(date).getTime() - 60 * 60 * 1000).toISOString();
        case ReminderType.ONE_DAY_BEFORE:
            return new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000).toISOString();
        case ReminderType.ONE_WEEK_BEFORE:
            return new Date(new Date(date).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
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
    console.log("Calculating reminder type with startAt:", startAt, "and sendAt:", sendAt);
    const diff = (new Date(startAt).getTime() - new Date(sendAt).getTime()) / 60000;
    if (diff === 60) return ReminderType.ONE_HOUR_BEFORE;
    if (diff === 24 * 60) return ReminderType.ONE_DAY_BEFORE;
    if (diff === 7 * 24 * 60) return ReminderType.ONE_WEEK_BEFORE;
    return ReminderType.NONE;
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
    MONTH_NAMES_ES,
    DAY_NAMES_ES,
};
