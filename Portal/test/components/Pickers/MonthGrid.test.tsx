import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MonthGrid } from "@/src/components/Pickers/MonthGrid";

function Harness({ initial = "2026-11", ...props }: Partial<React.ComponentProps<typeof MonthGrid>> & { initial?: string }) {
    const [ month, setMonth ] = useState(initial);
    return (
        <MonthGrid
            month={month}
            today="2026-11-22"
            onSelect={() => {}}
            {...props}
            onMonth={(next) => { setMonth(next); props.onMonth?.(next); }}
        />
    );
}

const day = (name: RegExp) => screen.getByRole("button", { name });

describe("MonthGrid", () => {
    it("lays the month out Monday first, with blanks before the 1st", () => {
        render(<Harness />);
        expect(screen.queryByRole("grid")).toBeNull();
        const table = screen.getByRole("table", { name: "noviembre de 2026" });
        const cells = within(table).getAllByRole("cell");
        expect(cells.slice(0, 6).every((cell) => cell.textContent === "")).toBe(true);
        expect(cells[6]).toHaveTextContent("1");
        const headers = screen.getAllByRole("columnheader");
        expect(headers.map((h) => h.textContent)).toEqual([ "L", "M", "X", "J", "V", "S", "D" ]);
        expect(headers.map((h) => h.getAttribute("aria-label"))).toEqual(
            [ "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo" ],
        );
        expect(headers[2]).toHaveAccessibleName("miércoles");
    });

    it("marks today and the selected day", () => {
        render(<Harness selected="2026-11-25" />);
        expect(day(/domingo, 22 de noviembre de 2026/)).toHaveAttribute("aria-current", "date");
        expect(day(/miércoles, 25 de noviembre de 2026/)).toHaveAttribute("aria-pressed", "true");
        expect(day(/jueves, 26 de noviembre de 2026/)).toHaveAttribute("aria-pressed", "false");
    });

    it("disables days the predicate rejects and never selects them", () => {
        const onSelect = vi.fn();
        render(<Harness onSelect={onSelect} isDisabled={(d) => d < "2026-11-22"} />);
        expect(day(/ 21 de noviembre/)).toBeDisabled();
        fireEvent.click(day(/ 21 de noviembre/));
        expect(onSelect).not.toHaveBeenCalled();
        fireEvent.click(day(/ 23 de noviembre/));
        expect(onSelect).toHaveBeenCalledWith("2026-11-23");
    });

    it("moves between months and stops at the bounds", () => {
        render(<Harness minMonth="2026-11" maxMonth="2027-01" />);
        expect(screen.getByRole("button", { name: "Mes anterior" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
        expect(screen.getByText("diciembre de 2026")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
        expect(screen.getByText("enero de 2027")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
        expect(screen.getByText("diciembre de 2026")).toBeInTheDocument();
    });

    it("jumps by month and year with the selects when given a year range", () => {
        const onMonth = vi.fn();
        render(<Harness years={{ from: 1906, to: 2026 }} maxMonth="2026-11" onMonth={onMonth} />);
        const year = screen.getByRole("combobox", { name: "Año" });
        const month = screen.getByRole("combobox", { name: "Mes" });
        expect(year).toHaveValue("2026");
        expect(month).toHaveValue("10");

        fireEvent.change(year, { target: { value: "1985" } });
        expect(onMonth).toHaveBeenLastCalledWith("1985-11");
        fireEvent.change(month, { target: { value: "4" } });
        expect(onMonth).toHaveBeenLastCalledWith("1985-05");
        expect(day(/ 1 de mayo de 1985/)).toBeInTheDocument();
    });

    it("clamps a year jump to the navigable months", () => {
        const onMonth = vi.fn();
        render(<Harness initial="2025-12" years={{ from: 1906, to: 2026 }} maxMonth="2026-11" onMonth={onMonth} />);
        fireEvent.change(screen.getByRole("combobox", { name: "Año" }), { target: { value: "2026" } });
        expect(onMonth).toHaveBeenLastCalledWith("2026-11");
    });

    it("disables months past the bounds in the month select", () => {
        render(<Harness years={{ from: 2000, to: 2026 }} maxMonth="2026-11" />);
        const december = within(screen.getByRole("combobox", { name: "Mes" })).getByRole("option", { name: "Diciembre" });
        expect(december).toBeDisabled();
    });
});

describe("MonthGrid keyboard", () => {
    const press = (el: HTMLElement, key: string) => fireEvent.keyDown(el, { key });
    const focused = () => document.activeElement as HTMLElement;

    it("has one tab stop: the selected day, else today, else the first enabled day", () => {
        const { unmount } = render(<Harness selected="2026-11-10" />);
        const stops = () => screen.getAllByRole("button", { name: /de 2026$/ }).filter((b) => b.tabIndex === 0);
        expect(stops().map((b) => b.textContent)).toEqual([ "10" ]);
        unmount();

        const second = render(<Harness />);
        expect(stops().map((b) => b.textContent)).toEqual([ "22" ]);
        second.unmount();

        render(<Harness isDisabled={(d) => d < "2026-11-05"} initial="2026-11" today="2026-10-01" />);
        expect(stops().map((b) => b.textContent)).toEqual([ "5" ]);
    });

    it("moves by day and week with the arrow keys", () => {
        render(<Harness selected="2026-11-10" />);
        const start = day(/martes, 10 de noviembre/);
        start.focus();
        press(start, "ArrowRight");
        expect(focused()).toHaveAccessibleName(/miércoles, 11 de noviembre/);
        press(focused(), "ArrowDown");
        expect(focused()).toHaveAccessibleName(/miércoles, 18 de noviembre/);
        press(focused(), "ArrowLeft");
        expect(focused()).toHaveAccessibleName(/martes, 17 de noviembre/);
        press(focused(), "ArrowUp");
        expect(focused()).toHaveAccessibleName(/martes, 10 de noviembre/);
    });

    it("Home and End go to the Monday and Sunday of the week", () => {
        render(<Harness selected="2026-11-11" />);
        const start = day(/miércoles, 11 de noviembre/);
        start.focus();
        press(start, "End");
        expect(focused()).toHaveAccessibleName(/domingo, 15 de noviembre/);
        press(focused(), "Home");
        expect(focused()).toHaveAccessibleName(/lunes, 9 de noviembre/);
    });

    it("crosses into the next and previous month, keeping focus on the day", () => {
        const onMonth = vi.fn();
        render(<Harness selected="2026-11-30" onMonth={onMonth} />);
        const last = day(/lunes, 30 de noviembre/);
        last.focus();
        press(last, "ArrowRight");
        expect(onMonth).toHaveBeenLastCalledWith("2026-12");
        expect(focused()).toHaveAccessibleName(/martes, 1 de diciembre/);
        press(focused(), "ArrowLeft");
        expect(onMonth).toHaveBeenLastCalledWith("2026-11");
        expect(focused()).toHaveAccessibleName(/lunes, 30 de noviembre/);
    });

    it("PageUp and PageDown change month and clamp the day", () => {
        render(<Harness initial="2026-01" today="2026-01-31" selected="2026-01-31" />);
        const start = day(/sábado, 31 de enero/);
        start.focus();
        press(start, "PageDown");
        expect(focused()).toHaveAccessibleName(/sábado, 28 de febrero/);
        press(focused(), "PageUp");
        expect(focused()).toHaveAccessibleName(/enero de 2026/);
    });

    it("skips disabled days and stops at the month bounds", () => {
        render(<Harness selected="2026-11-10" isDisabled={(d) => d === "2026-11-11"} maxMonth="2026-11" />);
        const start = day(/martes, 10 de noviembre/);
        start.focus();
        press(start, "ArrowRight");
        expect(focused()).toHaveAccessibleName(/jueves, 12 de noviembre/);

        const onMonth = vi.fn();
        const bounded = render(<Harness selected="2026-11-30" maxMonth="2026-11" onMonth={onMonth} />);
        const last = within(bounded.container).getByRole("button", { name: /lunes, 30 de noviembre/ });
        last.focus();
        press(last, "ArrowRight");
        expect(onMonth).not.toHaveBeenCalled();
        expect(focused()).toBe(last);
    });
});
