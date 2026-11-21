import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useState } from "react";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { DayPanel } from "@/src/components/Calendar/DayPanel";

async function settle() {
    for (let i = 0; i < 4; i++) {
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    }
}

const BASE = { __NA: true, tree: "calendar" };

function Calendar() {
    const [ day, setDay ] = useState<string | null>(null);
    return (
        <>
            <button type="button" onClick={() => setDay("2026-11-23")}>abrir día</button>
            {day && (
                <DayPanel
                    selectedDay={day}
                    appts={[]}
                    blockedTimes={[]}
                    onClose={() => setDay(null)}
                    onViewAppt={vi.fn()}
                    onDrillToDay={vi.fn()}
                    onCreateAt={vi.fn()}
                    onSelectBlockedTime={vi.fn()}
                    onCreateBlockedTime={vi.fn()}
                />
            )}
        </>
    );
}

const panel = () => document.querySelector(".cal-day-panel");

beforeEach(() => {
    window.history.pushState(BASE, "", "/calendar");
});

afterEach(settle);

describe("DayPanel and Back", () => {
    it("closes on Back and stays on the calendar entry", async () => {
        render(<FocusTrapProvider dismissOnBack><Calendar /></FocusTrapProvider>);
        act(() => screen.getByRole("button", { name: "abrir día" }).click());
        await settle();
        expect(panel()).not.toBeNull();
        expect(typeof window.history.state.overlay).toBe("string");

        await act(async () => window.history.back());
        await settle();

        expect(panel()).toBeNull();
        expect(window.history.state).toEqual(BASE);
    });

    it("removes its entry when its own button closes it", async () => {
        render(<FocusTrapProvider dismissOnBack><Calendar /></FocusTrapProvider>);
        act(() => screen.getByRole("button", { name: "abrir día" }).click());
        await settle();

        act(() => screen.getByRole("button", { name: "Nueva cita" }).click());
        await settle();

        expect(panel()).toBeNull();
        expect(window.history.state).toEqual(BASE);
    });
});
