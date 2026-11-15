import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsSection } from "@/src/components/Settings/SettingsSection";

describe("SettingsSection", () => {
    it("names the region by its title and shows description, status and actions", () => {
        render(
            <SettingsSection title="Logos" description="PNG · Máx. 5 MB" status={<span>Guardado</span>} actions={<button>Nuevo</button>}>
                body
            </SettingsSection>,
        );
        const region = screen.getByRole("region", { name: "Logos" });
        expect(within(region).getByRole("heading", { level: 2, name: "Logos" })).toBeInTheDocument();
        expect(region).toHaveTextContent("PNG · Máx. 5 MB");
        expect(within(region).getByText("Guardado")).toBeInTheDocument();
        expect(within(region).getByRole("button", { name: "Nuevo" })).toBeInTheDocument();
        expect(region).toHaveTextContent("body");
    });

    it("omits the description when none is given", () => {
        const { container } = render(<SettingsSection title="Logos">body</SettingsSection>);
        expect(container.querySelector(".settings-section__description")).toBeNull();
    });

    it("keeps the anchor id and test id", () => {
        render(<SettingsSection title="Logos" id="logos" testId="logos-section">body</SettingsSection>);
        const region = screen.getByTestId("logos-section");
        expect(region).toHaveAttribute("id", "logos");
    });
});
