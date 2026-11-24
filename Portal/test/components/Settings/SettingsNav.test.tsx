import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsNav } from "@/src/components/Settings/SettingsNav";

let pathname = "/settings/services";
const push = vi.fn();
let attention = new Set<string>();

vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/src/providers/SettingsAttentionContext", () => ({
    useSettingsAttention: () => ({ sections: attention, report: vi.fn() }),
}));
vi.mock("@/src/providers/AuthContext", () => ({ useAuthContext: () => ({ user: { role: "ADMIN" } }) }));

beforeEach(() => {
    pathname = "/settings/services";
    push.mockReset();
    attention = new Set();
});

describe("SettingsNav", () => {
    it("shows the three groups and marks the current section", () => {
        render(<SettingsNav />);
        const menu = screen.getByRole("navigation", { name: "Secciones de configuración" });
        for (const name of [ "Tu cuenta", "Tu consulta", "Conexiones" ]) {
            expect(within(menu).getByRole("group", { name })).toBeInTheDocument();
        }
        expect(screen.getByTestId("settings-nav-services")).toHaveAttribute("aria-current", "page");
        expect(screen.getByTestId("settings-nav-select")).toHaveValue("services");
    });

    it("marks the section that needs attention in menu and dropdown", () => {
        attention = new Set([ "integrations" ]);
        render(<SettingsNav />);
        expect(screen.getByTestId("settings-nav-integrations")).toContainElement(screen.getByTestId("settings-nav-integrations-attention"));
        expect(screen.queryByTestId("settings-nav-account-attention")).toBeNull();
        expect(within(screen.getByTestId("settings-nav-select")).getByRole("option", { name: "Integraciones (requiere atención)" })).toBeInTheDocument();
    });

    it("lets the dropdown reach Cuenta from a section that is not in the menu", async () => {
        pathname = "/settings/elsewhere";
        render(<SettingsNav />);
        const select = screen.getByTestId("settings-nav-select");
        expect(select).toHaveValue("");

        await userEvent.selectOptions(select, "account");
        expect(push).toHaveBeenCalledWith("/settings/account");
    });

    it("navigates from the dropdown", async () => {
        render(<SettingsNav />);
        await userEvent.selectOptions(screen.getByTestId("settings-nav-select"), "integrations");
        expect(push).toHaveBeenCalledWith("/settings/integrations");
    });
});
