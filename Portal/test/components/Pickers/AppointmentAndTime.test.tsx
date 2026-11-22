import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { describe, expect, it, vi } from "vitest";
import { AppointmentDateTimePicker } from "@/src/components/AppointmentDateTimePicker";
import { PickerField } from "@/src/components/Pickers/PickerField";
import { renderWithTrap, useTouchEnv } from "./touchEnv";

dayjs.extend(utc);

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

const dialog = () => screen.getByRole("dialog");
const button = (name: string | RegExp) => within(dialog()).getByRole("button", { name });

describe("AppointmentDateTimePicker on a touch screen", () => {
    useTouchEnv({ now: "2026-03-01T15:32:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid" });

    function renderPicker(props: Partial<React.ComponentProps<typeof AppointmentDateTimePicker>> = {}) {
        const onChange = vi.fn();
        const onError = vi.fn();
        renderWithTrap(<AppointmentDateTimePicker date={undefined} onChange={onChange} onError={onError} {...props} />);
        fireEvent.click(screen.getByRole("button", { name: /Selecciona fecha y hora|\d{2}\/\d{2}\/\d{4}/ }));
        return { onChange, onError };
    }

    it("offers business hours only, with the last hour on the hour", () => {
        renderPicker();
        fireEvent.click(button(/ 2 de marzo de 2026/));
        const hours = within(within(dialog()).getByRole("group", { name: "Hora" })).getAllByRole("button");
        expect(hours.map((h) => h.textContent)).toEqual(
            [ "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20" ],
        );
        fireEvent.click(button("20 h"));
        expect(button("20:00")).toBeEnabled();
        expect(button("20:05")).toBeDisabled();
    });

    it("disables past days and earlier times today in the provider zone", () => {
        renderPicker();
        expect(button("Mes anterior")).toBeDisabled();
        fireEvent.click(button(/ 1 de marzo de 2026/));
        expect(button("10 h")).toBeEnabled();
        expect(button("09 h")).toBeDisabled();
        expect(button("15 h")).toBeEnabled();
        fireEvent.click(button("10 h"));
        expect(button("10:30")).toBeDisabled();
        expect(button("10:35")).toBeEnabled();
    });

    it("saves a 5-minute slot as the provider-zone instant", async () => {
        const { onChange } = renderPicker();
        fireEvent.click(button(/ 2 de marzo de 2026/));
        fireEvent.click(button("14 h"));
        fireEvent.click(button("14:45"));
        fireEvent.click(button("Listo"));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-03-02T19:45:00.000Z"));
    });

    it("refuses a booked slot through onError", async () => {
        const { onChange, onError } = renderPicker({ bookedSlots: [ "2026-03-02T19:45:00.000Z" ] });
        fireEvent.click(button(/ 2 de marzo de 2026/));
        fireEvent.click(button("14 h"));
        fireEvent.click(button("14:45"));
        fireEvent.click(button("Listo"));
        await waitFor(() => expect(onError).toHaveBeenCalledWith("Este horario ya está reservado"));
        expect(onChange).not.toHaveBeenCalled();
    });

    it("confirming its own booked slot unchanged re-runs no check", async () => {
        const { onChange, onError } = renderPicker({ date: "2026-03-02T19:45:00.000Z", bookedSlots: [ "2026-03-02T19:45:00.000Z" ] });
        fireEvent.click(button("Listo"));
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(onError).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe("time PickerField on a touch screen", () => {
    useTouchEnv({ now: "2026-03-01T15:32:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid" });
    const base = { kind: "time", today: "2026-03-01", format: "HH:mm", title: "Hora" } as const;

    it("picks a wall time of day at the minute step and keeps the base day", async () => {
        const onChange = vi.fn();
        renderWithTrap(
            <PickerField
                {...base}
                value={dayjs.utc("2000-01-01T09:00:00")}
                onChange={onChange}
                minuteStep={5}
                allowClear={false}
                ariaLabel="Lunes: desde"
                title="Lunes: desde"
                testId="availability-start"
            />,
        );
        const trigger = screen.getByTestId("availability-start");
        expect(trigger).toHaveTextContent("09:00");
        expect(screen.queryByRole("button", { name: /Borrar/ })).toBeNull();
        fireEvent.click(trigger);
        expect(dialog()).toHaveAccessibleName("Lunes: desde");
        fireEvent.click(button("17 h"));
        fireEvent.click(button("17:00"));
        fireEvent.click(button("Listo"));
        await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        expect(onChange.mock.calls[0][0].format("YYYY-MM-DD HH:mm")).toBe("2000-01-01 17:00");
    });

    it("honours disabledTime and clears when allowed", () => {
        const onChange = vi.fn();
        renderWithTrap(
            <PickerField
                {...base}
                value={dayjs.utc("2000-01-01T09:00:00")}
                onChange={onChange}
                allowClear
                minuteStep={15}
                disabledTime={() => ({ disabledHours: () => [ 8 ], disabledMinutes: (h: number) => (h === 9 ? [ 45 ] : []) })}
                testId="t"
            />,
        );
        fireEvent.click(screen.getByTestId("t"));
        expect(button("08 h")).toBeDisabled();
        expect(button("09:45")).toBeDisabled();
        expect(within(within(dialog()).getByRole("group", { name: "Minutos" })).getAllByRole("button")).toHaveLength(4);
        fireEvent.click(button("Cancelar"));
        fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0]).toBeNull();
    });

    it("passes invalid on to the trigger as aria-invalid", () => {
        renderWithTrap(
            <PickerField {...base} value={dayjs.utc("2000-01-01T09:00:00")} onChange={() => {}} invalid testId="t" />,
        );
        expect(screen.getByTestId("t")).toHaveAttribute("aria-invalid", "true");
    });
});
