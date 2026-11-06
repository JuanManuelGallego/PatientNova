import { useState } from "react";
import { useFetchPublicSlots } from "@/src/api/public-booking/useFetchPublicSlots";
import { useRescheduleSlots } from "@/src/api/portal/usePortalBooking";
import type { PublicProvider, PublicSlot } from "@/src/types/PublicBooking";
import { todayFormattedString } from "@/src/utils/TimeUtils";
import {
    groupSlotsByDay, lastBookableDateIn, lastDayOfMonth, MAX_EMPTY_WINDOWS, mergeSlots, monthOf, slotQueryRange, slotWindow,
} from "@/src/utils/publicBooking";

type SlotSource = { typeId: string | null } | { rescheduleId: string };

/**
 * Day and time selection for one appointment type, in the patient's device zone. Shared by booking
 * (`/book/[slug]`) and rescheduling ("Mis citas"), so both follow the same zone and paging rules.
 *
 * Slots load one window at a time from today and accumulate, so the first-available shortcut, the day
 * strip and the month calendar all read one list. `source` picks where times come from: the public slots
 * of a type, or the session's reschedule slots for one appointment.
 */
export function useSlotChooser(slug: string, provider: PublicProvider, source: SlotSource, timezone: string) {
    const today = todayFormattedString(timezone);
    const lastDate = lastBookableDateIn(timezone, provider.lastBookableDate, provider.timezone);
    const sourceKey = "typeId" in source ? `type:${source.typeId}` : `move:${source.rescheduleId}`;
    const rescheduleId = "rescheduleId" in source ? source.rescheduleId : null;

    const [ loadedKey, setLoadedKey ] = useState(sourceKey);
    const [ windowIndex, setWindowIndex ] = useState(0);
    const [ loaded, setLoaded ] = useState<PublicSlot[]>([]);
    const [ dayChoice, setDayChoice ] = useState<string | null>(null);
    const [ startUtc, setStartUtc ] = useState<string | null>(null);
    const [ notice, setNotice ] = useState<string | null>(null);
    const [ through, setThrough ] = useState<string | null>(null);

    const restart = () => {
        setLoaded([]);
        setWindowIndex(0);
        setThrough(null);
    };

    if (loadedKey !== sourceKey) {
        setLoadedKey(sourceKey);
        restart();
        setDayChoice(null);
        setStartUtc(null);
        setNotice(null);
    }

    const current = slotWindow(windowIndex, today, lastDate);
    const query = slotQueryRange(current.from, current.to);
    const publicSlots = useFetchPublicSlots(slug, "typeId" in source ? source.typeId : null, query.from, query.to);
    const moveSlots = useRescheduleSlots(rescheduleId, query.from, query.to);
    const { slots, loading, error, retry } = rescheduleId ? moveSlots : publicSlots;

    const all = slots ? mergeSlots(loaded, slots.slots) : loaded;
    const days = groupSlotsByDay(all, timezone)
        .filter((d) => d.date >= today && d.date <= lastDate)
        .sort((a, b) => a.date.localeCompare(b.date));
    const openDays = days.map((d) => d.date);
    const day = days.find((d) => d.date === dayChoice) ?? days[ 0 ];
    const firstSlot = days[ 0 ] && [ ...days[ 0 ].morning, ...days[ 0 ].afternoon ][ 0 ];
    const slot = days.flatMap((d) => [ ...d.morning, ...d.afternoon ]).find((s) => s.startUtc === startUtc);

    // The calendar opens on the chosen day's month, so that month must load whole or its later days read as closed.
    const dayMonthEnd = day ? lastDayOfMonth(monthOf(day.date)) : null;
    const covered = [ through, dayMonthEnd ].reduce<string | null>((a, b) => (a && b ? (a > b ? a : b) : a ?? b), null);

    const nextWindow = windowIndex + 1;
    const advances = !!slots && current.hasNext && (
        (openDays.length === 0 && nextWindow < MAX_EMPTY_WINDOWS) || (covered !== null && current.to < covered)
    );
    const advance = () => {
        setLoaded(all);
        setWindowIndex(nextWindow);
    };

    // Adjusted during render: the new window has no data yet, so this cannot repeat until its answer arrives.
    if (advances) advance();

    const pick = (next: string | null) => {
        setStartUtc(next);
        setNotice(null);
    };

    return {
        timezone,
        today,
        lastDate,
        openDays,
        day,
        slot,
        firstSlot,
        loading,
        error,
        retry,
        notice,
        hasMore: current.hasNext,
        loadMore: () => { if (slots && current.hasNext) advance(); },
        /** Keeps loading windows until `date` is covered, for a month the calendar moved to. */
        loadThrough: (date: string) => setThrough(date),
        pick,
        chooseDay: (date: string) => { setDayChoice(date); pick(null); },
        chooseFirst: () => {
            if (!firstSlot || !days[ 0 ]) return;
            setDayChoice(days[ 0 ].date);
            pick(firstSlot.startUtc);
        },
        /** Forgets everything and asks again, for a new booking after one was made. */
        reload: () => {
            setDayChoice(null);
            pick(null);
            restart();
            retry();
        },
        /** The server refused the chosen time: drop it, say why and reload from the start. */
        slotTaken: (message: string) => {
            setStartUtc(null);
            setNotice(message);
            restart();
            retry();
        },
    };
}

export type SlotChooserState = ReturnType<typeof useSlotChooser>;
