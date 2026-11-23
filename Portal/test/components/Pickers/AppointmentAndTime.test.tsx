import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppointmentDateTimePicker } from "@/src/components/AppointmentDateTimePicker";
import { renderWithTrap, useTouchEnv } from "./touchEnv";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

type Props = React.ComponentProps<typeof AppointmentDateTimePicker>;

function Harness({ initial, onChange, ...props }: Partial<Props> & { initial?: string }) {
    const [ date, setDate ] = useState(initial);
    return <AppointmentDateTimePicker {...props} date={date} onChange={(v) => { setDate(v); onChange?.(v); }} />;
}

const dateBox = () => screen.getByTestId("appointment-start-date") as HTMLInputElement;
const timeBox = () => screen.getByTestId("appointment-start-time") as HTMLInputElement;
const typeIn = (input: HTMLElement, text: string) => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.blur(input);
};
const typeAndEnter = (input: HTMLElement, text: string) => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: "Enter" });
};
const optionNames = () => within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.getAttribute("aria-label"));

const BOOKED = [ { start: "2026-03-02T16:00:00.000Z", end: "2026-03-02T17:00:00.000Z" } ];
const BLOCKED = [ { start: "2026-03-02T18:00:00.000Z", end: "2026-03-02T19:30:00.000Z" } ];

describe("AppointmentDateTimePicker with a mouse", () => {
    useTouchEnv({ now: "2026-03-01T15:32:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid", coarse: false });

    it("lists business hours only, from 06:00 to 20:00", () => {
        renderWithTrap(<Harness initial="2026-03-02T14:00:00.000Z" />);
        fireEvent.click(timeBox());
        const names = optionNames();
        expect(names[0]).toBe("06:00");
        expect(names.at(-1)).toBe("20:00");
        typeAndEnter(timeBox(), "20:05");
        expect(timeBox()).toHaveAttribute("aria-invalid", "true");
    });

    it("refuses past days and earlier times today in the provider zone", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness onChange={onChange} />);
        typeIn(dateBox(), "28/02/2026");
        expect(dateBox().value).toBe("");
        typeIn(dateBox(), "01/03/2026");
        fireEvent.click(timeBox());
        expect(optionNames()[0]).toBe("10:45");
        typeIn(timeBox(), "10:30");
        expect(onChange).not.toHaveBeenCalled();
        typeIn(timeBox(), "10:35");
        expect(onChange).toHaveBeenCalledWith("2026-03-01T15:35:00.000Z");
    });

    it("saves a 5-minute time as the provider-zone instant and says when it ends", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial="2026-03-02T14:00:00.000Z" duration={50} onChange={onChange} />);
        typeIn(timeBox(), "14:45");
        expect(onChange).toHaveBeenCalledWith("2026-03-02T19:45:00.000Z");
        expect(timeBox()).toHaveAccessibleDescription("Termina 15:35");
    });

    it("greys out times that would overlap a cita or a bloqueo for the cita's whole length", () => {
        renderWithTrap(<Harness initial="2026-03-02T14:00:00.000Z" duration={60} bookedSlots={BOOKED} blockedSlots={BLOCKED} />);
        fireEvent.click(timeBox());
        const names = optionNames();
        expect(names).toContain("10:00");
        expect(names).toContain("10:15, ocupada");
        expect(names).toContain("11:45, ocupada");
        expect(names).toContain("12:00");
        expect(names).toContain("12:15, bloqueada");
        expect(names).toContain("14:30");
    });

    it("uses the cita's duration: a longer one is refused sooner", () => {
        renderWithTrap(<Harness initial="2026-03-02T14:00:00.000Z" duration={90} bookedSlots={BOOKED} />);
        fireEvent.click(timeBox());
        expect(optionNames()).toContain("09:30");
        expect(optionNames()).toContain("09:45, ocupada");
    });

    it("explains a typed overlap and does not save it", () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial="2026-03-02T14:00:00.000Z" bookedSlots={BOOKED} onChange={onChange} />);
        typeAndEnter(timeBox(), "11:30");
        expect(timeBox()).toHaveAccessibleDescription("Se cruza con la cita de 11:00 a 12:00");
        expect(onChange).not.toHaveBeenCalled();
    });

    it("shows busy times of that day only", () => {
        renderWithTrap(<Harness initial="2026-03-03T14:00:00.000Z" bookedSlots={BOOKED} blockedSlots={BLOCKED} />);
        fireEvent.click(timeBox());
        expect(optionNames().some((n) => n!.includes(","))).toBe(false);
    });
});

describe("AppointmentDateTimePicker on a touch screen", () => {
    useTouchEnv({ now: "2026-03-01T15:32:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid" });

    it("picks the time from the sheet, where busy times cannot be tapped", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial="2026-03-02T14:00:00.000Z" bookedSlots={BOOKED} onChange={onChange} />);
        fireEvent.click(screen.getByTestId("appointment-start-time"));
        const sheet = screen.getByRole("dialog");
        fireEvent.click(within(sheet).getByRole("option", { name: "11:00, ocupada" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        fireEvent.click(within(sheet).getByRole("option", { name: "14:45" }));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-03-02T19:45:00.000Z"));
    });
});
