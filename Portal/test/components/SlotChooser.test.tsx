import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlotChooser } from "@/src/components/PublicBooking/SlotChooser";
import { useSlotChooser } from "@/src/components/PublicBooking/useSlotChooser";
import type { PublicProvider, PublicSlot } from "@/src/types/PublicBooking";
import {
    addCalendarDays, addMonths, fmtDayParts, fmtMonth, fmtShortDayTime, lastDayOfMonth, MAX_EMPTY_WINDOWS, monthOf, SLOT_WINDOW_DAYS,
} from "@/src/utils/publicBooking";

const TZ = "America/Bogota";
const today = "2026-11-06";

const provider = {
    displayName: "Dra. Ana",
    timezone: TZ,
    lastBookableDate: "2099-12-31",
} as PublicProvider;

const at = (day: string, hourUtc = 14): PublicSlot => {
    const startUtc = `${day}T${String(hourUtc).padStart(2, "0")}:00:00.000Z`;
    return { startUtc, endUtc: startUtc };
};

const fetchMock = vi.fn();
const slotCalls = () => fetchMock.mock.calls.map(([ url ]) => new URL(String(url), "http://x").searchParams);

/** Answers each request with the slots whose day falls in the requested range. */
function serve(slots: PublicSlot[]) {
    fetchMock.mockImplementation(async (url: string) => {
        const params = new URL(url, "http://x").searchParams;
        const from = params.get("from")!;
        const to = params.get("to")!;
        const inRange = slots.filter((s) => s.startUtc.slice(0, 10) >= from && s.startUtc.slice(0, 10) <= to);
        return new Response(JSON.stringify({ success: true, data: { timezone: TZ, slots: inRange } }), { status: 200 });
    });
}

function Harness({ owner = provider, timezone = TZ }: { owner?: PublicProvider; timezone?: string }) {
    const [ typeId, setTypeId ] = useState("t1");
    const picker = useSlotChooser("dra-ana", owner, { typeId }, timezone);
    return (
        <>
            <SlotChooser picker={picker} />
            <output aria-label="elegido">{picker.slot?.startUtc ?? "ninguno"}</output>
            <button type="button" onClick={() => setTypeId("t2")}>Otro tipo</button>
            <button type="button" onClick={() => picker.slotTaken("Ese horario ya no está disponible.")}>Simular ocupado</button>
        </>
    );
}

const strip = () => screen.findByRole("group", { name: "Días disponibles" });
const calendar = () => screen.getByRole("group", { name: "Calendario de horarios" });
const chosen = () => screen.getByRole("status", { name: "elegido" }).textContent;
const fullName = (day: string) => fmtDayParts(day).full;

beforeEach(() => {
    vi.useFakeTimers({ toFake: [ "Date" ], now: new Date(`${today}T12:00:00.000Z`) });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.replaceState(null, "");
});

describe("SlotChooser", () => {
    it("opens on the first day with times and offers its first slot as a shortcut", async () => {
        const first = at(addCalendarDays(today, 2));
        serve([ first, at(addCalendarDays(today, 5)) ]);
        render(<Harness />);

        const days = await strip();
        expect(within(days).getByRole("button", { name: fullName(addCalendarDays(today, 2)) })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: /Primer horario disponible/ })).toHaveTextContent(fmtShortDayTime(first.startUtc, TZ));
    });

    it("lists in the strip only the days that have times", async () => {
        serve([ at(addCalendarDays(today, 2)), at(addCalendarDays(today, 5)) ]);
        render(<Harness />);

        expect(within(await strip()).getAllByRole("button")).toHaveLength(2);
    });

    it("picking the shortcut selects that day and time", async () => {
        const user = userEvent.setup();
        const first = at(addCalendarDays(today, 2));
        serve([ first ]);
        render(<Harness />);

        await user.click(await screen.findByRole("button", { name: /Primer horario disponible/ }));
        expect(chosen()).toBe(first.startUtc);
    });

    it("skips empty windows by itself and stops once the first slot's month is loaded", async () => {
        const slot = at(addCalendarDays(today, SLOT_WINDOW_DAYS + 3)); // 6 December: its month ends in the third window
        serve([ slot ]);
        render(<Harness />);

        await strip();
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    });

    it("stops after the limit of empty windows and offers to keep looking", async () => {
        const user = userEvent.setup();
        serve([]);
        render(<Harness />);

        expect(await screen.findByText("No hay horarios disponibles por ahora.")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(MAX_EMPTY_WINDOWS);

        await user.click(screen.getByRole("button", { name: "Buscar más adelante" }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(MAX_EMPTY_WINDOWS + 1));
    });

    it("offers no more searching once the horizon ends", async () => {
        serve([]);
        render(<Harness owner={{ ...provider, lastBookableDate: addCalendarDays(today, 3) }} />);

        expect(await screen.findByText("No hay horarios disponibles por ahora.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Buscar más adelante" })).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("keeps earlier days on screen while later ones load", async () => {
        const user = userEvent.setup();
        serve([ at(addCalendarDays(today, 1)), at(addCalendarDays(today, SLOT_WINDOW_DAYS + 1)) ]);
        render(<Harness />);
        await strip();

        let answer: (r: Response) => void = () => undefined;
        fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { answer = resolve; }));
        await user.click(screen.getByRole("button", { name: "Ver más fechas" }));

        expect(within(await strip()).getByRole("button", { name: fullName(addCalendarDays(today, 1)) })).toBeInTheDocument();
        answer(new Response(JSON.stringify({ success: true, data: { timezone: TZ, slots: [ at(addCalendarDays(today, SLOT_WINDOW_DAYS + 1)) ] } })));
        await waitFor(async () => expect(within(await strip()).getAllByRole("button")).toHaveLength(2));
    });

    it("does not repeat a slot that two padded requests return", async () => {
        const user = userEvent.setup();
        const edge = at(addCalendarDays(today, SLOT_WINDOW_DAYS));
        serve([ at(addCalendarDays(today, 1)), edge ]);
        render(<Harness />);
        await strip();

        await user.click(screen.getByRole("button", { name: "Ver más fechas" }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        await waitFor(async () => expect(within(await strip()).getAllByRole("button")).toHaveLength(2));
    });

    it("uses the patient's zone and shows no day past the horizon", async () => {
        const last = addCalendarDays(today, 3);
        const lateOnLastDay = at(addCalendarDays(last, 1), 3); // 22:00 on the provider's last day
        const pastHorizon = at(addCalendarDays(last, 2), 3);
        serve([ lateOnLastDay, pastHorizon ]);
        render(<Harness owner={{ ...provider, lastBookableDate: last }} timezone="Asia/Tokyo" />);

        const days = await strip();
        expect(within(days).getAllByRole("button")).toHaveLength(1);
        expect(within(days).getByRole("button", { name: fullName(addCalendarDays(last, 1)) })).toBeInTheDocument();
    });

    it("opens the month in a sheet from Ver calendario, and picking a day closes it and shows its times", async () => {
        const user = userEvent.setup();
        const later = addCalendarDays(today, 4);
        serve([ at(addCalendarDays(today, 1)), at(later, 20) ]);
        render(<Harness />);
        await strip();

        await user.click(screen.getByRole("button", { name: "Ver calendario" }));
        const sheet = screen.getByRole("dialog", { name: "Calendario de horarios" });
        await user.click(within(sheet).getByRole("button", { name: fullName(later) }));

        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(within(await strip()).getByRole("button", { name: fullName(later) })).toHaveAttribute("aria-pressed", "true");
    });

    it("keeps closed days inert and disables months outside the horizon", async () => {
        const user = userEvent.setup();
        const open = addCalendarDays(today, 1);
        serve([ at(open) ]);
        render(<Harness owner={{ ...provider, lastBookableDate: lastDayOfMonth(monthOf(open)) }} />);
        await strip();

        const month = within(calendar());
        expect(month.getByRole("button", { name: "Mes anterior" })).toBeDisabled();
        expect(month.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();

        const closed = month.getByRole("button", { name: `${fullName(today)}, sin horarios` });
        expect(closed).toHaveAttribute("aria-disabled", "true");
        await user.click(closed);
        expect(within(await strip()).getByRole("button", { name: fullName(open) })).toHaveAttribute("aria-pressed", "true");
    });

    it("loads through the end of a later month when moving to it", async () => {
        const user = userEvent.setup();
        const nextMonth = addMonths(monthOf(today), 1);
        serve([ at(today), at(`${nextMonth}-28`) ]);
        render(<Harness />);
        await strip();

        await user.click(within(calendar()).getByRole("button", { name: "Mes siguiente" }));
        expect(within(calendar()).getByText(fmtMonth(nextMonth))).toBeInTheDocument();
        await waitFor(() => expect(within(calendar()).getByRole("button", { name: fullName(`${nextMonth}-28`) })).not.toHaveAttribute("aria-disabled"));
    });

    it("shows every open day of the month it opens on", async () => {
        const days = Array.from({ length: 29 }, (_, i) => addCalendarDays("2026-12-03", i));
        serve(days.map((day) => at(day)));
        render(<Harness />);
        await strip();

        await waitFor(() => expect(within(calendar()).getByRole("button", { name: fullName("2026-12-31") })).not.toHaveAttribute("aria-disabled"));
        expect(within(calendar()).getByText(fmtMonth("2026-12"))).toBeInTheDocument();
    });

    it("never asks for more than the API allows", async () => {
        const user = userEvent.setup();
        serve([ at(today) ]);
        render(<Harness />);
        await strip();
        await user.click(within(calendar()).getByRole("button", { name: "Mes siguiente" }));
        await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));

        for (const params of slotCalls()) {
            const days = (Date.parse(params.get("to")!) - Date.parse(params.get("from")!)) / 86_400_000;
            expect(days).toBeLessThan(31);
        }
    });

    it("a taken slot clears the time, says why and reloads from the first window", async () => {
        const user = userEvent.setup();
        const first = at(addCalendarDays(today, 1));
        serve([ first ]);
        render(<Harness />);
        await user.click(await screen.findByRole("button", { name: /Primer horario disponible/ }));
        const calls = fetchMock.mock.calls.length;

        serve([]);
        await user.click(screen.getByRole("button", { name: "Simular ocupado" }));

        const notice = await screen.findByRole("alert");
        expect(notice).toHaveTextContent("Ese horario ya no está disponible.");
        expect(notice).toHaveFocus();
        expect(chosen()).toBe("ninguno");
        expect(slotCalls()[ calls ]!.get("from")).toBe(slotCalls()[ 0 ]!.get("from"));
        expect(await screen.findByText("No hay horarios disponibles por ahora.")).toBeInTheDocument();
    });

    it("clears the time and reloads when the type changes", async () => {
        const user = userEvent.setup();
        serve([ at(addCalendarDays(today, 1)) ]);
        render(<Harness />);
        await user.click(await screen.findByRole("button", { name: /Primer horario disponible/ }));

        await user.click(screen.getByRole("button", { name: "Otro tipo" }));

        expect(chosen()).toBe("ninguno");
        await waitFor(() => expect(slotCalls().at(-1)!.get("typeId")).toBe("t2"));
    });

    it("states the time zone", async () => {
        serve([ at(addCalendarDays(today, 1)) ]);
        render(<Harness />);
        await strip();
        expect(screen.getByText(/Horas en tu zona horaria: Colombia/)).toBeInTheDocument();
    });
});
