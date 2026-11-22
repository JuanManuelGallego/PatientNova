import { render, screen, within } from "@testing-library/react";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomTabBar } from "@/src/components/BottomTabBar";
import Sidebar from "@/src/components/Sidebar";

let pathname = "/dashboard";
let role: string | null = "ADMIN";
let inbox = { enabled: true, pending: 0 };

vi.mock("next/navigation", () => ({
    usePathname: () => pathname,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
    default: ({ href, replace, onClick, children, ...rest }: {
        href: string; replace?: boolean; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void; children: ReactNode;
    }) => (
        <a
            href={href}
            data-replace={replace ? "true" : "false"}
            onClick={(e) => {
                onClick?.(e);
                if (e.defaultPrevented) e.currentTarget.dataset.skipped = "true";
                e.preventDefault();
            }}
            {...rest}
        >
            {children}
        </a>
    ),
}));
vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({
        user: role ? { role, firstName: "Ana", lastName: "Ruiz", displayName: "Dra. Ana", avatar: "", jobTitle: "Psicóloga" } : null,
        logout: vi.fn(),
    }),
}));
vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }) }));
vi.mock("@/src/providers/SettingsAttentionContext", () => ({
    useSettingsAttention: () => ({ sections: new Set(), report: vi.fn() }),
}));
vi.mock("@/src/providers/PendingRequestsContext", () => ({
    usePendingRequests: () => ({ ...inbox, refetch: vi.fn() }),
}));

const originalMatchMedia = window.matchMedia;

function stubMatchMedia(matches: (query: string) => boolean) {
    window.matchMedia = ((query: string) => ({
        matches: matches(query),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
}

const tabIds = () =>
    within(screen.getByTestId("bottom-tabbar")).getAllByRole("link").map((a) => a.getAttribute("data-testid")!.replace("tabbar-link-", ""));

beforeEach(() => {
    pathname = "/dashboard";
    role = "ADMIN";
    inbox = { enabled: true, pending: 0 };
});

afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
});

describe("BottomTabBar", () => {
    it("links the five daily screens with one-word labels", () => {
        render(<BottomTabBar />);

        const nav = screen.getByRole("navigation", { name: "Accesos directos" });
        const links = within(nav).getAllByRole("link");
        expect(links.map((a) => a.textContent)).toEqual([ "Hoy", "Calendario", "Citas", "Pacientes", "Solicitudes" ]);
        expect(links.map((a) => a.getAttribute("href"))).toEqual([ "/dashboard", "/calendar", "/appointments", "/patients", "/requests" ]);
    });

    it("marks the tab of the current route, sub-routes included", () => {
        pathname = "/patients/p-1";
        render(<BottomTabBar />);

        expect(screen.getByTestId("tabbar-link-patients")).toHaveAttribute("aria-current", "page");
        for (const id of [ "dashboard", "calendar", "appointments", "requests" ]) {
            expect(screen.getByTestId(`tabbar-link-${id}`)).not.toHaveAttribute("aria-current");
        }
    });

    it("marks no tab on a page outside the bar", () => {
        pathname = "/reminders";
        render(<BottomTabBar />);

        expect(screen.queryAllByRole("link").filter((a) => a.hasAttribute("aria-current"))).toEqual([]);
    });

    it("shows the sidebar's pending-requests count, capped at 99+", () => {
        inbox = { enabled: true, pending: 120 };
        render(<BottomTabBar />);

        const badge = screen.getByTestId("tabbar-requests-badge");
        expect(screen.getByTestId("tabbar-link-requests")).toContainElement(badge);
        expect(badge).toHaveTextContent("99+");
    });

    it("announces the count after the tab's name", () => {
        inbox = { enabled: true, pending: 3 };
        render(<BottomTabBar />);

        expect(screen.getByRole("link", { name: "Solicitudes, 3 pendientes" })).toBe(screen.getByTestId("tabbar-link-requests"));
    });

    it("is inert while the menu is open, so no tab can push over the menu's history entry", () => {
        const { rerender } = render(<BottomTabBar inert />);
        expect(screen.getByTestId("bottom-tabbar")).toHaveAttribute("inert");

        rerender(<BottomTabBar inert={false} />);
        expect(screen.getByTestId("bottom-tabbar")).not.toHaveAttribute("inert");
    });

    it("shows no badge with nothing pending", () => {
        render(<BottomTabBar />);
        expect(screen.queryByTestId("tabbar-requests-badge")).toBeNull();
    });

    it.each([
        [ "VIEWER", false ], [ "ADMIN", false ], [ "ADMIN", true ], [ "SUPER_ADMIN", true ],
    ] as const)("shows a tab only when the sidebar shows that item (%s, inbox %s)", (r, enabled) => {
        role = r;
        inbox = { enabled, pending: 0 };
        render(<><Sidebar isOpen={false} onClose={vi.fn()} /><BottomTabBar /></>);

        const ids = tabIds();
        for (const id of ids) expect(screen.getByTestId(`sidebar-link-${id}`)).toBeInTheDocument();
        expect(ids.includes("requests")).toBe(enabled);
    });

    it("pushes a history entry like any link (it is never under the open menu)", () => {
        render(<BottomTabBar />);

        const link = screen.getByTestId("tabbar-link-calendar");
        expect(link).toHaveAttribute("data-replace", "false");
        link.click();
        expect(link).not.toHaveAttribute("data-skipped");
    });

    it("scrolls back to the top instead of reloading the page it is on", () => {
        window.history.replaceState(null, "", "/dashboard");
        const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
        render(<BottomTabBar />);

        const link = screen.getByTestId("tabbar-link-dashboard");
        link.click();

        expect(link).toHaveAttribute("data-skipped", "true");
        expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    });

    it("renders nothing from 1024px, where the sidebar is always shown", () => {
        stubMatchMedia((query) => query === "(min-width: 1024px)");
        render(<BottomTabBar />);

        expect(screen.queryByTestId("bottom-tabbar")).toBeNull();
    });
});
