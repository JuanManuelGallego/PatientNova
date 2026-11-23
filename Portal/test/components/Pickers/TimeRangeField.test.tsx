import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TimeRangeField, type TimeRange } from "@/src/components/Pickers/TimeRangeField";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));

function Harness({ initial, onChange, endOfDay }: { initial: TimeRange; onChange?: (r: TimeRange) => void; endOfDay?: boolean }) {
    const [ value, setValue ] = useState(initial);
    return (
        <TimeRangeField
            value={value}
            onChange={(next) => { setValue(next); onChange?.(next); }}
            startLabel="Lunes: hora de inicio"
            endLabel="Lunes: hora de fin"
            startTestId="start"
            endTestId="end"
            endOfDay={endOfDay}
        />
    );
}

const start = () => screen.getByTestId("start") as HTMLInputElement;
const end = () => screen.getByTestId("end") as HTMLInputElement;
const typeIn = (input: HTMLInputElement, text: string) => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.blur(input);
};

describe("TimeRangeField", () => {
    it("names both boxes and says how long the range lasts", () => {
        render(<Harness initial={{ start: "09:00", end: "12:00" }} />);
        expect(screen.getByRole("combobox", { name: "Lunes: hora de inicio" })).toBe(start());
        expect(screen.getByRole("combobox", { name: "Lunes: hora de fin" })).toBe(end());
        expect(end()).toHaveAccessibleDescription("3 h");
    });

    it("keeps the length when the start moves", () => {
        const onChange = vi.fn();
        render(<Harness initial={{ start: "09:00", end: "12:00" }} onChange={onChange} />);
        typeIn(start(), "13:00");
        expect(onChange).toHaveBeenCalledWith({ start: "13:00", end: "16:00" });
        expect(end().value).toBe("16:00");
    });

    it("stops a moved end at the last time of the day", () => {
        const onChange = vi.fn();
        render(<Harness initial={{ start: "09:00", end: "12:00" }} onChange={onChange} endOfDay />);
        typeIn(start(), "22:00");
        expect(onChange).toHaveBeenCalledWith({ start: "22:00", end: "24:00" });
    });

    it("changes only the end when the end moves, listing times after the start", () => {
        const onChange = vi.fn();
        render(<Harness initial={{ start: "09:00", end: "12:00" }} onChange={onChange} />);
        fireEvent.click(end());
        const first = within(screen.getByRole("listbox")).getAllByRole("option")[0];
        expect(first).toHaveAccessibleName("09:15, 15 min");
        typeIn(end(), "10:30");
        expect(onChange).toHaveBeenCalledWith({ start: "09:00", end: "10:30" });
    });

    it("reads a typed 0:00 end as the end of the day when that is allowed", () => {
        const onChange = vi.fn();
        render(<Harness initial={{ start: "20:00", end: "23:00" }} onChange={onChange} endOfDay />);
        typeIn(end(), "0:00");
        expect(onChange).toHaveBeenCalledWith({ start: "20:00", end: "24:00" });
        expect(end().value).toBe("24:00");
    });
});
