import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "@/src/components/Form/Switch";

describe("Switch", () => {
    it("is a named switch that shows and toggles its state", async () => {
        const onChange = vi.fn();
        const { rerender } = render(<Switch checked={false} onChange={onChange} label="Reserva en línea" />);
        const sw = screen.getByRole("switch", { name: "Reserva en línea" });
        expect(sw).not.toBeChecked();
        expect(screen.getByText("Desactivada")).toBeInTheDocument();
        await userEvent.click(sw);
        expect(onChange).toHaveBeenCalledWith(true);
        rerender(<Switch checked onChange={onChange} label="Reserva en línea" />);
        expect(screen.getByText("Activada")).toBeInTheDocument();
    });

    it("does not toggle when disabled", async () => {
        const onChange = vi.fn();
        render(<Switch checked={false} onChange={onChange} label="Reserva en línea" disabled />);
        await userEvent.click(screen.getByRole("switch"));
        expect(onChange).not.toHaveBeenCalled();
    });
});
