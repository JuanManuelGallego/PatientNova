import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "@/src/components/Sidebar";

let pathname = "/dashboard";
let role: string | null = "ADMIN";
let inbox = { enabled: true, pending: 0 };
let attention = new Set<string>();

vi.mock("next/navigation", () => ({
    usePathname: () => pathname,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({
        user: role ? { role, firstName: "Ana", lastName: "Ruiz", displayName: "Dra. Ana", avatar: "", jobTitle: "Psicóloga" } : null,
        logout: vi.fn(),
    }),
}));
vi.mock("@/src/providers/ThemeContext", () => ({
    useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));
vi.mock("@/src/providers/SettingsAttentionContext", () => ({
    useSettingsAttention: () => ({ sections: attention, report: vi.fn() }),
}));
vi.mock("@/src/providers/PendingRequestsContext", () => ({
    usePendingRequests: () => ({ ...inbox, refetch: vi.fn() }),
}));

beforeEach(() => {
    pathname = "/dashboard";
    role = "ADMIN";
    inbox = { enabled: true, pending: 0 };
    attention = new Set();
});

describe("Sidebar", () => {
    it("puts a dot on Configuración when a section needs attention", () => {
        const { unmount } = render(<Sidebar isOpen onClose={vi.fn()} />);
        expect(screen.queryByTestId("sidebar-settings-attention")).toBeNull();
        unmount();

        attention = new Set([ "integrations" ]);
        render(<Sidebar isOpen onClose={vi.fn()} />);
        expect(screen.getByTestId("sidebar-link-settings")).toContainElement(screen.getByTestId("sidebar-settings-attention"));
        expect(screen.getByTestId("sidebar-settings-attention")).toHaveTextContent("requiere atención");
    });

    it("marks Configuración active on a settings sub-route", () => {
        pathname = "/settings/account";
        render(<Sidebar isOpen onClose={vi.fn()} />);

        const settings = screen.getByTestId("sidebar-link-settings");
        expect(settings).toHaveAttribute("aria-current", "page");
        expect(settings.querySelector(".nav-item")).toHaveClass("active");
        expect(settings).toHaveAttribute("href", "/settings/account");
        expect(screen.getByTestId("sidebar-link-patients")).not.toHaveAttribute("aria-current");
    });

    it("hides the inbox and Actividad from a viewer without the inbox", () => {
        role = "VIEWER";
        inbox = { enabled: false, pending: 0 };
        render(<Sidebar isOpen onClose={vi.fn()} />);

        expect(screen.queryByTestId("sidebar-link-requests")).toBeNull();
        expect(screen.queryByTestId("sidebar-link-activity")).toBeNull();
        expect(screen.getByTestId("sidebar-link-settings")).toBeInTheDocument();
    });

    it("shows group headers, Actividad and a capped inbox badge to an admin", () => {
        inbox = { enabled: true, pending: 120 };
        render(<Sidebar isOpen onClose={vi.fn()} />);

        expect(screen.getByText("Consulta")).toBeInTheDocument();
        expect(screen.getByText("Administración")).toBeInTheDocument();
        expect(screen.getByTestId("sidebar-link-activity")).toHaveAttribute("href", "/activity");
        expect(screen.getByTestId("sidebar-requests-badge")).toHaveTextContent("99+");
    });

    it("closes the mobile drawer when a link is chosen", async () => {
        const onClose = vi.fn();
        render(<Sidebar isOpen onClose={onClose} />);

        await userEvent.click(screen.getByTestId("sidebar-link-patients"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("lists Configuración last in Administración", () => {
        render(<Sidebar isOpen onClose={vi.fn()} />);

        const admin = screen.getByRole("group", { name: "Administración" });
        const links = within(admin).getAllByRole("link").map((a) => a.getAttribute("data-testid"));
        expect(links).toEqual([ "sidebar-link-activity", "sidebar-link-settings" ]);
    });
});
