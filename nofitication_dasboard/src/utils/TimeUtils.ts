import { ReminderType } from "../types/Reminder";

function fmtDateTime(iso: string | undefined) {
    if (!iso) return "Invalid Date"
    return new Date(iso).toLocaleString("es-ES", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

function fmtDate(d: string | undefined) {
    if (!d) return "Invalid Date"
    return new Date(d).toLocaleDateString("es-ES", {
        weekday: "short", day: "numeric", month: "short",
    });
}

function isoToLocal(iso: string) {
    const date = new Date(iso);
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function fmtRelative(iso: string | undefined) {
    if (!iso) return "Invalid Date"
    const diff = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(diff);
    if (abs < 60_000) return "Ahora mismo";
    if (abs < 3_600_000) return `${Math.round(abs / 60_000)} min`;
    if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)} h`;
    return `${Math.round(abs / 86_400_000)} días`;
}

function today() {
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

    const appointmentDateTime = new Date(date);
    const now = new Date();
    const timeUntilAppointment = appointmentDateTime.getTime() - now.getTime();

    const reminderOffsets: Record<ReminderType, number> = {
        [ ReminderType.ONE_HOUR_BEFORE ]: 60 * 60 * 1000,
        [ ReminderType.ONE_DAY_BEFORE ]: 24 * 60 * 60 * 1000,
        [ ReminderType.ONE_WEEK_BEFORE ]: 7 * 24 * 60 * 60 * 1000,
        [ ReminderType.NONE ]: 0,
    };

    const requiredTime = reminderOffsets[ reminderType ];
    return timeUntilAppointment > requiredTime;
}


function getRemindersentAt(date: string, reminderType: ReminderType): string {
    switch (reminderType) {
        case ReminderType.ONE_HOUR_BEFORE:
            return new Date(new Date(date).getTime() - 60 * 60 * 1000).toISOString();
        case ReminderType.ONE_DAY_BEFORE:
            return new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000).toISOString();
        case ReminderType.ONE_WEEK_BEFORE:
            return new Date(new Date(date).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        default:
            return new Date(date).toISOString();
    }
}

function getDate(iso: string) {
    return new Date(iso).toISOString().slice(0, 10);
}

function getTime(iso: string) {
    return new Date(iso).toISOString().slice(11, 16);
}

export { fmtDateTime, fmtDate, isoToLocal, fmtRelative, today, MONTH_NAMES_ES, DAY_NAMES_ES, getRemindersentAt, isReminderTypeFeasible, getDate, getTime };
