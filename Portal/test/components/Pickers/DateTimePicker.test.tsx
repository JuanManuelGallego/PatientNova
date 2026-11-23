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
const settled = () => new Promise((resolve) => setTimeout(resolve, 30));

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
