import { fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DateTimeRangeField, type DateTimeRange, type DateTimeRangeFieldProps } from "@/src/components/Pickers/DateTimeRangeField";
import { renderWithTrap, useTouchEnv } from "./touchEnv";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

function Harness({ initial, onChange, ...props }: Partial<DateTimeRangeFieldProps> & { initial: DateTimeRange }) {
    const [ value, setValue ] = useState(initial);
    return (
        <DateTimeRangeField
            label="Horario bloqueado"
            testId="block"
            {...props}
            value={value}
            onChange={(next) => { setValue(next); onChange?.(next); }}
        />
    );
}

const box = (part: "date" | "start" | "end") => screen.getByTestId(`block-${part}`) as HTMLInputElement;
const typeIn = (input: HTMLElement, text: string) => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.blur(input);
};
const NINE_TO_TEN = { start: "2026-03-02T14:00:00.000Z", end: "2026-03-02T15:00:00.000Z" };

describe("DateTimeRangeField", () => {
    useTouchEnv({ now: "2026-03-01T15:32:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid", coarse: false });

    it("is one group of Fecha, Desde and Hasta, saying how long it lasts", () => {
        renderWithTrap(<Harness initial={NINE_TO_TEN} />);
        const group = screen.getByRole("group", { name: "Horario bloqueado" });
        expect(within(group).getByRole("combobox", { name: "Desde" })).toBe(box("start"));
        expect(within(group).getByRole("combobox", { name: "Hasta" })).toBe(box("end"));
        expect([ box("date").value, box("start").value, box("end").value ]).toEqual([ "02/03/2026", "09:00", "10:00" ]);
        expect(box("end")).toHaveAccessibleDescription("1 h");
    });

    it("keeps the length when Desde moves", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial={NINE_TO_TEN} onChange={onChange} />);
        typeIn(box("start"), "12:30");
        expect(onChange).toHaveBeenCalledWith({ start: "2026-03-02T17:30:00.000Z", end: "2026-03-02T18:30:00.000Z" });
        expect(box("end").value).toBe("13:30");
    });

    it("lists Hasta from Desde with durations and changes only the end", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial={NINE_TO_TEN} onChange={onChange} />);
        fireEvent.click(box("end"));
        expect(within(screen.getByRole("listbox")).getAllByRole("option")[0]).toHaveAccessibleName("09:15, 15 min");
        fireEvent.keyDown(box("end"), { key: "Escape" });
        typeIn(box("end"), "11:30");
        expect(onChange).toHaveBeenCalledWith({ start: NINE_TO_TEN.start, end: "2026-03-02T16:30:00.000Z" });
    });

    it("stops the end at 23:55, never the next day", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial={NINE_TO_TEN} onChange={onChange} />);
        typeIn(box("start"), "23:30");
        expect(onChange).toHaveBeenCalledWith({ start: "2026-03-03T04:30:00.000Z", end: "2026-03-03T04:55:00.000Z" });
        typeIn(box("end"), "24:00");
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("refuses an end at or before the start", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial={NINE_TO_TEN} onChange={onChange} />);
        typeIn(box("end"), "8:00");
        expect(onChange).not.toHaveBeenCalled();
    });

    it("future only: moving to today moves a past start to today's first time, keeping the length", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial={NINE_TO_TEN} when="future" onChange={onChange} />);
        typeIn(box("date"), "01/03/2026");
        expect(onChange).toHaveBeenCalledWith({ start: "2026-03-01T15:45:00.000Z", end: "2026-03-01T16:45:00.000Z" });
    });

    it("moves both ends with the day", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial={NINE_TO_TEN} onChange={onChange} />);
        typeIn(box("date"), "05/03/2026");
        expect(onChange).toHaveBeenCalledWith({ start: "2026-03-05T14:00:00.000Z", end: "2026-03-05T15:00:00.000Z" });
    });
});
