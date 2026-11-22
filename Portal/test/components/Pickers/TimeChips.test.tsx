import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimeChips } from "@/src/components/Pickers/TimeChips";

const hours = () => within(screen.getByRole("group", { name: "Hora" })).getAllByRole("button");
const minutes = () => within(screen.getByRole("group", { name: "Minutos" })).getAllByRole("button");

describe("TimeChips", () => {
    it("asks for the hour first and shows minutes only once one is chosen", () => {
        const onHour = vi.fn();
        render(<TimeChips hour={null} minute={null} minuteStep={5} onHour={onHour} onMinute={() => {}} />);
        expect(hours()).toHaveLength(24);
        expect(screen.queryByRole("group", { name: "Minutos" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "14 h" }));
        expect(onHour).toHaveBeenCalledWith(14);
    });

    it("offers minutes at the field's step", () => {
        render(<TimeChips hour={9} minute={null} minuteStep={5} onHour={() => {}} onMinute={() => {}} />);
        expect(minutes().map((b) => b.textContent)).toEqual(
            [ ":00", ":05", ":10", ":15", ":20", ":25", ":30", ":35", ":40", ":45", ":50", ":55" ],
        );
    });

    it("honours a coarser step", () => {
        render(<TimeChips hour={9} minute={null} minuteStep={15} onHour={() => {}} onMinute={() => {}} />);
        expect(minutes().map((b) => b.textContent)).toEqual([ ":00", ":15", ":30", ":45" ]);
    });

    it("shows only the listed hours", () => {
        render(<TimeChips hour={null} minute={null} minuteStep={5} hours={[ 6, 7, 8 ]} onHour={() => {}} onMinute={() => {}} />);
        expect(hours().map((b) => b.textContent)).toEqual([ "06", "07", "08" ]);
    });

    it("disables hours and minutes and never picks them", () => {
        const onHour = vi.fn();
        const onMinute = vi.fn();
        render(
            <TimeChips hour={10} minute={null} minuteStep={5}
                disabledHours={[ 8, 9 ]}
                disabledMinutes={(h) => (h === 10 ? [ 0, 5, 10 ] : [])}
                onHour={onHour} onMinute={onMinute} />,
        );
        expect(screen.getByRole("button", { name: "09 h" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "09 h" }));
        expect(onHour).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "10:05" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "10:05" }));
        expect(onMinute).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "10:15" }));
        expect(onMinute).toHaveBeenCalledWith(15);
    });

    it("disables an hour whose every minute is disabled", () => {
        render(
            <TimeChips hour={null} minute={null} minuteStep={5}
                disabledMinutes={(h) => (h === 20 ? Array.from({ length: 12 }, (_, i) => i * 5) : [])}
                onHour={() => {}} onMinute={() => {}} />,
        );
        expect(screen.getByRole("button", { name: "20 h" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "19 h" })).toBeEnabled();
    });

    it("marks the chosen hour and minute", () => {
        render(<TimeChips hour={10} minute={30} minuteStep={5} onHour={() => {}} onMinute={() => {}} />);
        expect(screen.getByRole("button", { name: "10 h" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "10:30" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "10:35" })).toHaveAttribute("aria-pressed", "false");
    });
});
