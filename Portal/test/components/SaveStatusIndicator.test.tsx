import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";

const indicator = () => screen.getByTestId("save-status-indicator");

describe("SaveStatusIndicator", () => {
    it("is empty while idle", () => {
        render(<SaveStatusIndicator saving={false} status="idle" />);
        expect(indicator()).toHaveAttribute("data-status", "idle");
        expect(indicator()).toHaveTextContent("");
    });

    it("shows saving over any other state", () => {
        render(<SaveStatusIndicator saving status="saved" error="boom" />);
        expect(indicator()).toHaveAttribute("data-status", "saving");
        expect(indicator()).toHaveTextContent("Guardando…");
    });

    it("confirms a save", () => {
        render(<SaveStatusIndicator saving={false} status="saved" />);
        expect(indicator()).toHaveAttribute("data-status", "saved");
        expect(indicator()).toHaveTextContent("Guardado");
    });

    it("keeps the error while its message is set, even after the status cleared", () => {
        render(<SaveStatusIndicator saving={false} status="idle" error="Ese enlace ya está en uso." />);
        expect(indicator()).toHaveAttribute("data-status", "error");
        expect(indicator()).toHaveTextContent("Error al guardar");
        expect(indicator()).toHaveAttribute("title", "Ese enlace ya está en uso.");
    });
});
