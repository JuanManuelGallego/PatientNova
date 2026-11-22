import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DateTimePicker } from "@/src/components/DateTimePicker";
import { renderWithTrap, useTouchEnv } from "./touchEnv";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

type Props = React.ComponentProps<typeof DateTimePicker>;

function Controlled({ initial, onChange, ...props }: Omit<Props, "date" | "onChange"> & { initial?: string; onChange: (v: string) => void }) {
    const [ date, setDate ] = useState(initial);
    return <DateTimePicker {...props} date={date} onChange={(v) => { setDate(v); onChange(v); }} testId="picker" />;
}

const open = () => fireEvent.click(screen.getByTestId("picker"));
const dialog = () => screen.getByRole("dialog");
const pickDay = (name: RegExp) => fireEvent.click(within(dialog()).getByRole("button", { name }));
const tap = (name: string) => fireEvent.click(within(dialog()).getByRole("button", { name }));
const settled = () => new Promise((resolve) => setTimeout(resolve, 30));

describe("DateTimePicker on a touch screen, instant mode", () => {
    useTouchEnv({ now: "2026-03-01T15:32:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid" });

    it("renders a trigger with the field's test id instead of a typed input", () => {
        const { container } = renderWithTrap(<Controlled showTime isFuture onChange={() => {}} />);
        expect(container.querySelector("input")).toBeNull();
        expect(screen.getByTestId("picker")).toHaveTextContent("Selecciona fecha y hora");
    });

    it("shows the stored instant as the provider's wall clock", () => {
        renderWithTrap(<Controlled initial="2026-03-08T07:30:00.000Z" showTime isFuture onChange={() => {}} />);
        expect(screen.getByTestId("picker")).toHaveTextContent("08/03/2026 02:30");
    });

    it("picks a day, then the hour and minute, and saves the provider-zone instant", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled showTime isFuture onChange={onChange} />);
        open();
        expect(dialog()).toHaveAccessibleName("Fecha y hora");
        expect(within(dialog()).getByRole("button", { name: "Listo" })).toBeDisabled();

        pickDay(/ 8 de marzo de 2026/);
        expect(within(dialog()).getByRole("tab", { name: /Hora/ })).toHaveAttribute("aria-selected", "true");
        expect(within(dialog()).getByRole("tab", { name: /Hora/ })).toHaveFocus();
        tap("02 h");
        tap("02:30");
        tap("Listo");

        expect(screen.queryByRole("dialog")).toBeNull();
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-03-08T07:30:00.000Z"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("picker")).toHaveTextContent("08/03/2026 02:30");
    });

    it("disables past days, and earlier hours and minutes today, in the provider zone", () => {
        renderWithTrap(<Controlled showTime isFuture onChange={() => {}} />);
        open();
        expect(within(dialog()).getByRole("button", { name: "Mes anterior" })).toBeDisabled();
        pickDay(/ 1 de marzo de 2026/);
        expect(within(dialog()).getByRole("button", { name: "09 h" })).toBeDisabled();
        expect(within(dialog()).getByRole("button", { name: "11 h" })).toBeEnabled();
        tap("10 h");
        expect(within(dialog()).getByRole("button", { name: "10:30" })).toBeDisabled();
        expect(within(dialog()).getByRole("button", { name: "10:35" })).toBeEnabled();
    });

    it("lets the date tab change the day after choosing a time", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled initial="2026-03-08T15:00:00.000Z" showTime isFuture onChange={onChange} />);
        open();
        expect(within(dialog()).getByRole("tab", { name: /Fecha/ })).toHaveAttribute("aria-selected", "true");
        pickDay(/ 9 de marzo de 2026/);
        tap("Listo");
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-03-09T15:00:00.000Z"));
    });

    it("switches Fecha and Hora with the arrow keys, one tab stop at a time", () => {
        renderWithTrap(<Controlled initial="2026-03-08T15:00:00.000Z" showTime isFuture onChange={() => {}} />);
        open();
        const date = within(dialog()).getByRole("tab", { name: /Fecha/ });
        const time = within(dialog()).getByRole("tab", { name: /Hora/ });
        expect(date).toHaveAttribute("tabindex", "0");
        expect(time).toHaveAttribute("tabindex", "-1");
        expect(within(dialog()).getByRole("tabpanel")).toHaveAccessibleName(/Fecha/);
        fireEvent.keyDown(date, { key: "ArrowRight" });
        expect(time).toHaveAttribute("aria-selected", "true");
        expect(time).toHaveFocus();
        expect(within(dialog()).getByRole("tabpanel")).toHaveAccessibleName(/Hora/);
        fireEvent.keyDown(time, { key: "Home" });
        expect(date).toHaveFocus();
    });

    it("drops a time that the new day disables", () => {
        renderWithTrap(<Controlled initial="2026-03-02T14:00:00.000Z" showTime isFuture onChange={() => {}} />);
        open();
        pickDay(/ 1 de marzo de 2026/);
        expect(within(dialog()).getByRole("button", { name: "Listo" })).toBeDisabled();
        expect(within(dialog()).getByRole("button", { name: "09 h" })).toHaveAttribute("aria-pressed", "false");
    });

    it("discards the draft on Cancelar", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled showTime isFuture onChange={onChange} />);
        open();
        pickDay(/ 8 de marzo de 2026/);
        tap("Cancelar");
        expect(screen.queryByRole("dialog")).toBeNull();
        await settled();
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByTestId("picker")).toHaveTextContent("Selecciona fecha y hora");
    });

    it("names the trigger by its value outside a label, without describing it again", () => {
        renderWithTrap(<Controlled initial="2026-03-08T07:30:00.000Z" showTime isFuture onChange={() => {}} />);
        const trigger = screen.getByTestId("picker");
        expect(trigger).toHaveAccessibleName("08/03/2026 02:30");
        expect(trigger).not.toHaveAttribute("aria-describedby");
    });
});

describe("DateTimePicker on a touch screen, near midnight", () => {
    useTouchEnv({ now: "2026-03-02T04:30:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid" });

    it("keeps the provider's date as today and saves the late slot on it", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled showTime isFuture onChange={onChange} />);
        open();
        const today = within(dialog()).getByRole("button", { name: / 1 de marzo de 2026/ });
        expect(today).toHaveAttribute("aria-current", "date");
        expect(today).toBeEnabled();
        fireEvent.click(today);
        expect(within(dialog()).getByRole("button", { name: "22 h" })).toBeDisabled();
        tap("23 h");
        expect(within(dialog()).getByRole("button", { name: "23:25" })).toBeDisabled();
        tap("23:45");
        tap("Listo");
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-03-02T04:45:00.000Z"));
    });
});

describe("DateTimePicker on a touch screen, in a DST-gap provider zone", () => {
    useTouchEnv({ now: "2026-03-01T15:00:00Z", providerZone: "America/New_York", deviceZone: "Europe/Madrid" });

    it("moves a wall time that does not exist forward, as the desktop picker does", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled showTime isFuture onChange={onChange} />);
        open();
        pickDay(/ 8 de marzo de 2026/);
        tap("02 h");
        tap("02:30");
        tap("Listo");
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-03-08T07:30:00.000Z"));
    });
});

describe("DateTimePicker on a touch screen, on a fall-back night", () => {
    useTouchEnv({ now: "2026-10-30T12:00:00Z", providerZone: "America/New_York", deviceZone: "Europe/Madrid" });

    it("confirming the second 01:30 unchanged saves nothing, so it never becomes the first", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled initial="2026-11-01T06:30:00.000Z" showTime isFuture onChange={onChange} />);
        expect(screen.getByTestId("picker")).toHaveTextContent("01/11/2026 01:30");
        open();
        tap("Listo");
        expect(screen.queryByRole("dialog")).toBeNull();

        open();
        pickDay(/ 1 de noviembre de 2026/);
        tap("01 h");
        tap("01:30");
        tap("Listo");
        await settled();
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe("DateTimePicker on a touch screen, day modes", () => {
    useTouchEnv({ now: "2026-03-01T15:00:00Z", providerZone: "Pacific/Kiritimati" });

    it("calendarDay: jumps to a birth year and saves UTC midnight on the first tap", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled initial="1990-05-01T00:00:00.000Z" mode="calendarDay" onChange={onChange} />);
        expect(screen.getByTestId("picker")).toHaveTextContent("01/05/1990");
        open();
        expect(dialog()).toHaveAccessibleName("Fecha");
        expect(within(dialog()).queryByRole("button", { name: "Listo" })).toBeNull();
        expect(within(dialog()).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
        fireEvent.change(within(dialog()).getByRole("combobox", { name: "Año" }), { target: { value: "1985" } });
        pickDay(/ 14 de mayo de 1985/);
        expect(screen.queryByRole("dialog")).toBeNull();
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("1985-05-14T00:00:00.000Z"));
    });

    it("calendarDay: offers the stored year even when it is older than the usual window", () => {
        renderWithTrap(<Controlled initial="1890-02-10T00:00:00.000Z" mode="calendarDay" onChange={() => {}} />);
        open();
        const year = within(dialog()).getByRole("combobox", { name: "Año" });
        expect(year).toHaveValue("1890");
        expect(within(year).getByRole("option", { name: "1906" })).toBeInTheDocument();
    });

    it("calendarDay: tapping the stored day again saves nothing", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled initial="1990-05-01T00:00:00.000Z" mode="calendarDay" onChange={onChange} />);
        open();
        pickDay(/ 1 de mayo de 1990/);
        await settled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps the value announced when a <label> names the trigger", () => {
        renderWithTrap(<label>Nacimiento<Controlled initial="1990-05-01T00:00:00.000Z" mode="calendarDay" onChange={() => {}} /></label>);
        expect(screen.getByRole("button", { name: "Nacimiento" })).toHaveAccessibleDescription("01/05/1990");
    });

    it("calendarDay: today is the provider's day and later days are disabled", () => {
        renderWithTrap(<Controlled mode="calendarDay" onChange={() => {}} />);
        open();
        const today = within(dialog()).getByRole("button", { name: / 2 de marzo de 2026/ });
        expect(today).toHaveAttribute("aria-current", "date");
        expect(today).toBeEnabled();
        expect(within(dialog()).getByRole("button", { name: / 3 de marzo de 2026/ })).toBeDisabled();
    });

    it("localDate: saves the bare day", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled mode="localDate" onChange={onChange} />);
        open();
        pickDay(/ 1 de marzo de 2026/);
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-03-01"));
    });

    it("renders its sheet into the popup container when one is given", () => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        renderWithTrap(<Controlled mode="localDate" popupContainer={() => host} onChange={() => {}} />);
        open();
        expect(host).toContainElement(dialog());
        host.remove();
    });
});
