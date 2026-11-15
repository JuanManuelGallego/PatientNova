import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldError, InlineError } from "@/src/components/Info/InlineError";

describe("InlineError", () => {
    it("announces the message as an alert", () => {
        render(<InlineError message="No se pudo guardar" />);
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar");
    });
});

describe("FieldError", () => {
    it("carries the id a field points to with aria-describedby", () => {
        render(<FieldError id="phone-error" message="Número no válido" />);
        expect(screen.getByRole("alert")).toHaveAttribute("id", "phone-error");
        expect(screen.getByRole("alert")).toHaveTextContent("Número no válido");
    });
});
