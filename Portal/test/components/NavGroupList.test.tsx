import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NavGroupList } from "@/src/components/NavGroupList";
import type { NavGroup } from "@/src/config/navigation";

type Id = "account" | "services";
const GROUPS: NavGroup<Id>[] = [
    { id: "you", label: "Tu cuenta", items: [ { id: "account", path: "/settings/account", label: "Cuenta" } ] },
    { id: "clinic", label: "Tu consulta", items: [ { id: "services", path: "/settings/services", label: "Servicios" } ] },
];

describe("NavGroupList", () => {
    it("marks the active item and calls onNavigate", async () => {
        const onNavigate = vi.fn();
        render(<NavGroupList groups={GROUPS} pathname="/settings/services" onNavigate={onNavigate} testIdPrefix="settings-nav" ariaLabel="Secciones de configuración" />);

        expect(screen.getByRole("navigation", { name: "Secciones de configuración" })).toBeInTheDocument();
        expect(screen.getByRole("group", { name: "Tu consulta" })).toBeInTheDocument();
        expect(screen.getByTestId("settings-nav-services")).toHaveAttribute("aria-current", "page");
        expect(screen.getByTestId("settings-nav-account")).not.toHaveAttribute("aria-current");

        await userEvent.click(screen.getByTestId("settings-nav-account"));
        expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it("renders a badge next to an item", () => {
        render(
            <NavGroupList
                groups={GROUPS}
                pathname="/settings/account"
                testIdPrefix="settings-nav"
                ariaLabel="Secciones"
                badge={(item) => (item.id === "services" ? <span data-testid="dot" /> : null)}
            />,
        );
        expect(screen.getByTestId("settings-nav-services")).toContainElement(screen.getByTestId("dot"));
        expect(screen.getByTestId("settings-nav-account").querySelector("[data-testid='dot']")).toBeNull();
    });
});
