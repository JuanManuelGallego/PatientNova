import { COMMON_TIMEZONES, fmtTime, fmtTimezoneLabel, localDateTimeToUtc, todayFormattedString, zonedDateTimeParts } from "./TimeUtils";
import type { LoginChannel, PublicSlot, ReschedulePolicy } from "@/src/types/PublicBooking";


export const WEEK_DAYS = 7;

export function locationDetail(l: { isVirtual: boolean; address: string | null }): string | null {
    return l.isVirtual ? "Videollamada" : l.address || null;
}

export function addCalendarDays(day: string, days: number): string {
    const [ y, m, d ] = day.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

export interface SlotDay {
    date: string;
    morning: PublicSlot[];
    afternoon: PublicSlot[];
}

export function groupSlotsByDay(slots: PublicSlot[], timezone: string): SlotDay[] {
    const days = new Map<string, SlotDay>();
    for (const slot of slots) {
        const { dateStr, hour } = zonedDateTimeParts(slot.startUtc, timezone);
        let day = days.get(dateStr);
        if (!day) {
            day = { date: dateStr, morning: [], afternoon: [] };
            days.set(dateStr, day);
        }
        (hour < 12 ? day.morning : day.afternoon).push(slot);
    }
    return [ ...days.values() ];
}

export interface WeekPage {
    from: string;
    to: string;
    hasPrevious: boolean;
    hasNext: boolean;
}

/** The Sunday-to-Saturday week holding `start`, cut at the last bookable date. Its days before today stay listed, without slots. */
export function weekPage(start: string, today: string, lastBookableDate: string): WeekPage {
    const from = sundayOf(start < lastBookableDate ? start : lastBookableDate);
    const end = addCalendarDays(from, WEEK_DAYS - 1);
    return {
        from,
        to: end < lastBookableDate ? end : lastBookableDate,
        hasPrevious: from > today,
        hasNext: addCalendarDays(from, WEEK_DAYS) <= lastBookableDate,
    };
}

const ZONE_PADDING_DAYS = 2;

export function slotQueryRange(from: string, to: string): { from: string; to: string } {
    return { from: addCalendarDays(from, -ZONE_PADDING_DAYS), to: addCalendarDays(to, ZONE_PADDING_DAYS) };
}

export function lastBookableDateIn(zone: string, lastBookableDate: string, providerZone: string): string {
    const horizonEnd = Date.parse(localDateTimeToUtc(addCalendarDays(lastBookableDate, 1), "00:00:00", providerZone));
    return todayFormattedString(zone, new Date(horizonEnd - 1));
}

export function calendarDaysBetween(from: string, to: string): string[] {
    const days: string[] = [];
    for (let day = from; day <= to; day = addCalendarDays(day, 1)) days.push(day);
    return days;
}

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);
const sundayOf = (day: string) => addCalendarDays(day, -asDate(day).getUTCDay());
const part = (day: string, options: Intl.DateTimeFormatOptions) =>
    asDate(day).toLocaleDateString("es-CO", { timeZone: "UTC", ...options }).replace(/\.$/, "");

export function fmtDayParts(day: string): { weekday: string; dayNumber: string; full: string } {
    return {
        weekday: part(day, { weekday: "short" }),
        dayNumber: part(day, { day: "numeric" }),
        full: part(day, { weekday: "long", day: "numeric", month: "long" }),
    };
}

export function localDayOf(iso: string, zone: string): string {
    return todayFormattedString(zone, new Date(iso));
}

export function fmtLongDay(day: string): string {
    return part(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** "lunes, 3 de noviembre de 2026, 9:00 a. m." in `zone`: how patient pages name an appointment time. */
export function fmtLongDayTime(iso: string, zone: string): string {
    return `${fmtLongDay(localDayOf(iso, zone))}, ${fmtTime(iso, zone)}`;
}

export const APPROVAL_FOLLOW_UP = "Te avisaremos cuando tu cita quede confirmada.";

export const PENDING_MEETING_LINK_NOTE = "Te enviaremos el enlace de la videollamada.";

export function normalizePhone(value: string): string {
    return value.replace(/[\s()-]/g, "");
}

export const isE164 = (value: string) => /^\+[1-9]\d{7,14}$/.test(value);

export const PHONE_FORMAT_HINT = "Escríbelo con el indicativo del país, por ejemplo +57 300 123 4567.";

export const isPhoneChannel = (channel: LoginChannel) => channel !== "EMAIL";

export function fmtPhone(phone: string): string {
    const parts = /^\+57(\d{3})(\d{3})(\d{4})$/.exec(phone);
    return parts ? `+57 ${parts[ 1 ]} ${parts[ 2 ]} ${parts[ 3 ]}` : phone;
}

export const fmtContact = (contact: string, channel: LoginChannel) => (isPhoneChannel(channel) ? fmtPhone(contact) : contact);

export const whatsappUrl = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

export const mapUrl = (address: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function fmtBookingPolicy(policy: ReschedulePolicy | null): string {
    const cancel = "Puedes cancelarla desde Mis citas en cualquier momento antes de la cita";
    if (!policy) return `${cancel}.`;
    if (policy.maxReschedules === 0) return `${cancel}. No se puede reprogramar en línea.`;
    const notice = policy.minNoticeHours > 0 ? `, con al menos ${plural(policy.minNoticeHours, "hora", "horas")} de anticipación` : "";
    return `${cancel} y reprogramarla hasta ${plural(policy.maxReschedules, "vez", "veces")}${notice}.`;
}

export function fmtWeekRange(from: string, to: string): string {
    const month = (day: string) => part(day, { month: "short" });
    const day = (d: string) => part(d, { day: "numeric" });
    if (from === to) return `${day(from)} ${month(from)}`;
    return month(from) === month(to)
        ? `${day(from)} – ${day(to)} ${month(to)}`
        : `${day(from)} ${month(from)} – ${day(to)} ${month(to)}`;
}

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function fmtCop(value: number): string {
    return COP.format(value);
}

export function timezoneName(timezone: string): string {
    return COMMON_TIMEZONES.find((z) => z.value === timezone)?.label ?? fmtTimezoneLabel(timezone);
}
