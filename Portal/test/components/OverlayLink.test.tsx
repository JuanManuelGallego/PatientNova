import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useState, type MouseEvent, type ReactNode } from "react";
import { FocusTrapProvider, useFocusTrap } from "@/src/hooks/useFocusTrap";
import { OverlayLink } from "@/src/components/OverlayLink";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock("next/link", () => ({
    default: ({ href, onClick, children, ...rest }: {
        href: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void; children: ReactNode;
    }) => (
        <a
            href={href}
            onClick={(e) => {
                onClick?.(e);
                e.currentTarget.dataset.navigated = e.defaultPrevented ? "no" : "push";
                e.preventDefault();
            }}
            {...rest}
        >
            {children}
        </a>
    ),
}));

async function settle() {
    for (let i = 0; i < 4; i++) {
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    }
}

const BASE = { __NA: true, tree: "page" };

function Drawer({ onClose, href }: { onClose: () => void; href: string }) {
    const { ref, handleKeyDown } = useFocusTrap<HTMLDivElement>(onClose);
    return (
        <div ref={ref} onKeyDown={handleKeyDown} data-testid="drawer">
            <OverlayLink href={href} data-testid="drawer-link">Ver actividad</OverlayLink>
        </div>
    );
}

function Page({ href }: { href: string }) {
    const [ open, setOpen ] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>abrir</button>
            {open && <Drawer href={href} onClose={() => setOpen(false)} />}
            <OverlayLink href={href} data-testid="page-link">Fuera</OverlayLink>
        </>
    );
}

async function openDrawer(href: string) {
    render(<FocusTrapProvider dismissOnBack><Page href={href} /></FocusTrapProvider>);
    act(() => screen.getByRole("button", { name: "abrir" }).click());
    await settle();
}

beforeEach(() => {
    replace.mockClear();
    window.history.pushState(BASE, "", "/appointments");
});

afterEach(async () => {
    vi.restoreAllMocks();
    await settle();
});

describe("OverlayLink", () => {
    it("closes the overlay and replaces its entry with the new page", async () => {
        await openDrawer("/activity?entityId=a1");
        const back = vi.spyOn(window.history, "back");
        const link = screen.getByTestId("drawer-link");

        act(() => link.click());
        await settle();

        expect(link.dataset.navigated).toBe("no");
        expect(replace).toHaveBeenCalledWith("/activity?entityId=a1");
        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
        expect(back).not.toHaveBeenCalled();
    });

    it("replaces too for a link to the same page with other filters", async () => {
        await openDrawer("/appointments?patientId=p1");

        act(() => screen.getByTestId("drawer-link").click());
        await settle();

        expect(replace).toHaveBeenCalledWith("/appointments?patientId=p1");
        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
    });

    it("only closes the overlay for a link to the current URL", async () => {
        await openDrawer("/appointments");

        act(() => screen.getByTestId("drawer-link").click());
        await settle();

        expect(replace).not.toHaveBeenCalled();
        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
        expect(window.history.state).toEqual(BASE);
    });

    it("is a plain link outside an overlay", async () => {
        render(<FocusTrapProvider dismissOnBack><Page href="/activity" /></FocusTrapProvider>);
        const link = screen.getByTestId("page-link");

        act(() => link.click());

        expect(link.dataset.navigated).toBe("push");
        expect(replace).not.toHaveBeenCalled();
    });

    it("is a plain link without dismissOnBack", async () => {
        render(<FocusTrapProvider><Page href="/activity" /></FocusTrapProvider>);
        act(() => screen.getByRole("button", { name: "abrir" }).click());
        const link = screen.getByTestId("drawer-link");

        act(() => link.click());

        expect(link.dataset.navigated).toBe("push");
        expect(replace).not.toHaveBeenCalled();
    });
});
