import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DateTimeField, type DateTimeFieldProps } from "@/src/components/Pickers/DateTimeField";
import { renderWithTrap, useTouchEnv } from "./touchEnv";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

function Harness({ initial, onChange, ...props }: Partial<DateTimeFieldProps> & { initial?: string }) {
    const [ value, setValue ] = useState(initial);
    return (
        <DateTimeField
            label="Fecha y hora de envío"
            testId="when"
            {...props}
            value={value}
            onChange={(next) => { setValue(next); onChange?.(next); }}
        />
    );
}

const dateBox = () => screen.getByTestId("when-date") as HTMLInputElement;
const timeBox = () => screen.getByTestId("when-time") as HTMLInputElement;
const typeIn = (input: HTMLElement, text: string) => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.blur(input);
};
const options = () => within(screen.getByRole("listbox")).getAllByRole("option");

describe("DateTimeField with a mouse", () => {
    useTouchEnv({ now: "2026-03-01T15:32:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid", coarse: false });

    it("is a group of a date box and a time box, showing the provider's wall clock", () => {
        renderWithTrap(<Harness initial="2026-03-08T07:30:00.000Z" />);
        const group = screen.getByRole("group", { name: "Fecha y hora de envío" });
        expect(within(group).getByRole("combobox", { name: "Hora" })).toBe(timeBox());
        expect(dateBox().value).toBe("08/03/2026");
        expect(timeBox().value).toBe("02:30");
    });

    it("waits for both parts, then saves the provider-zone instant", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness onChange={onChange} />);
        typeIn(dateBox(), "08/03/2026");
        expect(onChange).not.toHaveBeenCalled();
        typeIn(timeBox(), "2:30");
        expect(onChange).toHaveBeenCalledWith("2026-03-08T07:30:00.000Z");
    });

    it("future only: refuses past days and lists today from the next allowed time", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness when="future" onChange={onChange} />);
        typeIn(dateBox(), "28/02/2026");
        expect(dateBox().value).toBe("");
        typeIn(dateBox(), "01/03/2026");
        fireEvent.click(timeBox());
        expect(options()[0]).toHaveAccessibleName("10:45");
        typeIn(timeBox(), "10:30");
        expect(onChange).not.toHaveBeenCalled();
        typeIn(timeBox(), "10:35");
        expect(onChange).toHaveBeenCalledWith("2026-03-01T15:35:00.000Z");
    });

    it("moves a time the new day rules out to that day's first time", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial="2026-03-02T14:00:00.000Z" when="future" onChange={onChange} />);
        expect(timeBox().value).toBe("09:00");
        typeIn(dateBox(), "01/03/2026");
        expect(onChange).toHaveBeenCalledWith("2026-03-01T15:45:00.000Z");
        expect(timeBox().value).toBe("10:45");
    });

    it("keeps the time when only the day changes and it is still allowed", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial="2026-03-08T15:00:00.000Z" when="future" onChange={onChange} />);
        typeIn(dateBox(), "09/03/2026");
        expect(onChange).toHaveBeenCalledWith("2026-03-09T15:00:00.000Z");
    });

    it("applies rules per day", () => {
        renderWithTrap(
            <Harness initial="2026-03-02T14:00:00.000Z"
                time={(day) => ({ min: "09:00", max: "10:00", unavailable: day === "2026-03-02" ? [ { start: "09:30", end: "10:30", label: "Ocupada" } ] : [] })} />,
        );
        fireEvent.click(timeBox());
        expect(options().map((o) => o.getAttribute("aria-label"))).toEqual([ "09:00", "09:15", "09:30, ocupada", "09:45, ocupada", "10:00, ocupada" ]);
        fireEvent.keyDown(timeBox(), { key: "Escape" });
        typeIn(dateBox(), "03/03/2026");
        fireEvent.click(timeBox());
        expect(options().every((o) => !o.hasAttribute("aria-disabled"))).toBe(true);
    });

    it("passes the hint to the time box", () => {
        renderWithTrap(<Harness initial="2026-03-02T14:00:00.000Z" time={{ duration: 50 }} hint="end" />);
        expect(timeBox()).toHaveAccessibleDescription("Termina 09:50");
    });

    it("shows a 12-hour clock from the format prop", () => {
        renderWithTrap(<Harness initial="2026-03-02T19:15:00.000Z" format="12h" />);
        expect(timeBox().value).toBe("2:15 p. m.");
    });
});

describe("DateTimeField with a mouse, near midnight", () => {
    useTouchEnv({ now: "2026-03-02T04:30:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid", coarse: false });

    it("keeps the provider's date as today and saves a late time on it", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness when="future" onChange={onChange} />);
        typeIn(dateBox(), "01/03/2026");
        fireEvent.click(timeBox());
        expect(options().map((o) => o.getAttribute("aria-label"))).toEqual([ "23:30", "23:45" ]);
        typeIn(timeBox(), "23:45");
        expect(onChange).toHaveBeenCalledWith("2026-03-02T04:45:00.000Z");
    });
});

describe("DateTimeField with a mouse, across DST", () => {
    useTouchEnv({ now: "2026-03-01T15:00:00Z", providerZone: "America/New_York", deviceZone: "Europe/Madrid", coarse: false });

    it("moves a wall time that does not exist forward", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness onChange={onChange} />);
        typeIn(dateBox(), "08/03/2026");
        typeIn(timeBox(), "02:30");
        expect(onChange).toHaveBeenCalledWith("2026-03-08T07:30:00.000Z");
    });

    it("choosing the second 01:30 of a fall-back night again saves nothing", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial="2026-11-01T06:30:00.000Z" onChange={onChange} />);
        expect(timeBox().value).toBe("01:30");
        fireEvent.click(timeBox());
        fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "01:30" }));
        typeIn(dateBox(), "01/11/2026");
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe("DateTimeField on a touch screen", () => {
    useTouchEnv({ now: "2026-03-01T15:32:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid" });

    it("picks the day in one sheet and the time in another", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness when="future" onChange={onChange} />);
        fireEvent.click(screen.getByTestId("when-date"));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: / 8 de marzo de 2026/ }));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId("when-time"));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("option", { name: "14:45" }));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-03-08T19:45:00.000Z"));
        expect(screen.getByTestId("when-time")).toHaveTextContent("14:45");
    });
});
