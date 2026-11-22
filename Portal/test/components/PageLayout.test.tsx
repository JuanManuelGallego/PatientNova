import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import type { MouseEvent, ReactNode } from "react";
import PageLayout from "@/src/components/PageLayout";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { installScrollRestorationModel } from "@/test/utils/scrollRestorationModel";

vi.mock("next/navigation", () => ({
    usePathname: () => "/dashboard",
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
        user: { role: "ADMIN", firstName: "Ana", lastName: "Ruiz", displayName: "Dra. Ana", avatar: "", jobTitle: "Psicóloga" },
        logout: vi.fn(),
    }),
}));
let isDark = false;
vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark, toggleTheme: vi.fn() }) }));
vi.mock("@/src/providers/SettingsAttentionContext", () => ({
    useSettingsAttention: () => ({ sections: new Set(), report: vi.fn() }),
}));
vi.mock("@/src/providers/PendingRequestsContext", () => ({
    usePendingRequests: () => ({ enabled: true, pending: 0, refetch: vi.fn() }),
}));
vi.mock("@/src/components/Info/ProviderAlerts", () => ({ ProviderAlerts: () => null }));

async function settle() {
    for (let i = 0; i < 4; i++) {
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    }
}

const BASE = { __NA: true, tree: "page" };

function renderLayout() {
    return render(
        <FocusTrapProvider dismissOnBack>
            <PageLayout><p>contenido</p></PageLayout>
        </FocusTrapProvider>,
    );
}

async function openSidebar() {
    act(() => screen.getByTestId("hamburger-button").click());
    await settle();
}

const isOpen = () => screen.getByTestId("sidebar").classList.contains("sidebar--open");

beforeEach(() => {
    isDark = false;
    window.history.pushState(BASE, "", "/dashboard");
});

afterEach(async () => {
    vi.restoreAllMocks();
    await settle();
});

describe("PageLayout mobile sidebar and Back", () => {
    it("closes the open sidebar on Back and stays on the page", async () => {
        renderLayout();
        await openSidebar();
        expect(isOpen()).toBe(true);
        expect(typeof window.history.state.overlay).toBe("string");

        await act(async () => window.history.back());
        await settle();

        expect(isOpen()).toBe(false);
        expect(window.history.state).toEqual(BASE);
    });

    it("removes the entry when Escape closes the sidebar", async () => {
        renderLayout();
        await openSidebar();

        act(() => { fireEvent.keyDown(window, { key: "Escape" }); });
        await settle();

        expect(isOpen()).toBe(false);
        expect(window.history.state).toEqual(BASE);
    });

    it("removes the entry when the backdrop closes the sidebar", async () => {
        renderLayout();
        await openSidebar();

        act(() => screen.getByTestId("sidebar-backdrop").click());
        await settle();

        expect(isOpen()).toBe(false);
        expect(window.history.state).toEqual(BASE);
    });

    it("lets a nav link replace the sidebar's entry instead of going back", async () => {
        renderLayout();
        await openSidebar();
        const back = vi.spyOn(window.history, "back");
        const link = screen.getByTestId("sidebar-link-patients");
        expect(link).toHaveAttribute("data-replace", "true");

        act(() => link.click());
        await settle();

        expect(link).not.toHaveAttribute("data-skipped");
        expect(isOpen()).toBe(false);
        expect(back).not.toHaveBeenCalled();
    });

    it("pushes as usual from a closed sidebar (desktop or menu shut)", () => {
        renderLayout();
        expect(screen.getByTestId("sidebar-link-patients")).toHaveAttribute("data-replace", "false");
    });

    it("just closes the sidebar for a link to the current page", async () => {
        renderLayout();
        await openSidebar();

        const link = screen.getByTestId("sidebar-link-dashboard");
        act(() => link.click());
        await settle();

        expect(link).toHaveAttribute("data-skipped", "true");
        expect(isOpen()).toBe(false);
        expect(window.history.state).toEqual(BASE);
    });
    it("never goes back when the page unmounts with the menu open (logout)", async () => {
        const view = renderLayout();
        await openSidebar();
        const menuState = window.history.state;
        const back = vi.spyOn(window.history, "back");
        const go = vi.spyOn(window.history, "go");

        view.rerender(<FocusTrapProvider dismissOnBack>{null}</FocusTrapProvider>);
        await settle();

        expect(back).not.toHaveBeenCalled();
        expect(go).not.toHaveBeenCalled();
        expect(window.history.state).toEqual(menuState);
    });

    it("keeps the scroll position when the backdrop closes the menu", async () => {
        const scroll = installScrollRestorationModel(480);
        try {
            renderLayout();
            await openSidebar();

            act(() => screen.getByTestId("sidebar-backdrop").click());
            await settle();

            expect(window.history.state).toEqual(BASE);
            expect(scroll.y).toBe(480);
        } finally {
            scroll.restore();
        }
    });

    it("shows the phone tab bar beside the page content, its links pushing as usual", () => {
        renderLayout();

        const bar = screen.getByTestId("bottom-tabbar");
        expect(screen.getByTestId("sidebar")).not.toContainElement(bar);
        expect(bar.closest(".page-shell")).not.toBeNull();
        expect(screen.getByTestId("tabbar-link-patients")).toHaveAttribute("data-replace", "false");
    });

    it("makes the tab bar inert while the menu is open, and live again once it closes", async () => {
        renderLayout();
        expect(screen.getByTestId("bottom-tabbar")).not.toHaveAttribute("inert");

        await openSidebar();
        expect(screen.getByTestId("bottom-tabbar")).toHaveAttribute("inert");

        act(() => screen.getByTestId("sidebar-backdrop").click());
        await settle();
        expect(screen.getByTestId("bottom-tabbar")).not.toHaveAttribute("inert");
    });

    it.each([
        [ false, "#FFFFFF" ],
        [ true, "#1A1825" ],
    ])("colours the browser bar like the top bar (dark theme %s)", (dark, color) => {
        isDark = dark;
        const view = renderLayout();

        const metas = document.head.querySelectorAll('meta[name="theme-color"]');
        expect(metas).toHaveLength(1);
        expect(metas[ 0 ]).toHaveAttribute("content", color);
        view.unmount();
        expect(document.head.querySelector('meta[name="theme-color"]')).toBeNull();
    });
});
