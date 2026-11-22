import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { StrictMode, useState, type ReactNode } from "react";
import { FocusTrapProvider, useBackScope, useFocusTrap } from "@/src/hooks/useFocusTrap";
import { installScrollRestorationModel } from "@/test/utils/scrollRestorationModel";

async function settle() {
    for (let i = 0; i < 4; i++) {
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    }
}

async function pressBack() {
    await act(async () => window.history.back());
    await settle();
}

function Overlay({ name, onClose }: { name: string; onClose?: () => void }) {
    const { ref, handleKeyDown } = useFocusTrap<HTMLDivElement>(onClose);
    return (
        <div ref={ref} onKeyDown={handleKeyDown} data-testid={name}>
            <button type="button" onClick={onClose}>cerrar {name}</button>
        </div>
    );
}

function Page({ withEscape = true }: { withEscape?: boolean }) {
    const [ drawer, setDrawer ] = useState(false);
    const [ modal, setModal ] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setDrawer(true)}>abrir drawer</button>
            {drawer && (
                <>
                    <Overlay name="drawer" onClose={withEscape ? () => setDrawer(false) : undefined} />
                    <button type="button" onClick={() => setModal(true)}>abrir modal</button>
                </>
            )}
            {modal && <Overlay name="modal" onClose={() => setModal(false)} />}
        </>
    );
}

function renderPage(ui: ReactNode = <Page />, dismissOnBack = true) {
    return render(<FocusTrapProvider dismissOnBack={dismissOnBack}>{ui}</FocusTrapProvider>);
}

function click(name: string) {
    act(() => screen.getByRole("button", { name }).click());
}

let baseLength = 0;

beforeEach(async () => {
    window.history.pushState({ __NA: true, tree: "page" }, "");
    baseLength = window.history.length;
});

afterEach(async () => {
    vi.restoreAllMocks();
    await settle();
});

describe("FocusTrapProvider dismissOnBack", () => {
    it("adds one history entry for an open overlay and keeps the router's state", async () => {
        renderPage();
        click("abrir drawer");
        await settle();

        expect(window.history.length).toBe(baseLength + 1);
        expect(window.history.state).toMatchObject({ __NA: true, tree: "page" });
        expect(typeof window.history.state.overlay).toBe("string");
    });

    it("closes the open overlay on Back and stays on the page entry", async () => {
        renderPage();
        click("abrir drawer");
        await settle();

        await pressBack();

        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
        expect(window.history.state).toEqual({ __NA: true, tree: "page" });
    });

    it("closes nested overlays one per Back, top first", async () => {
        renderPage();
        click("abrir drawer");
        await settle();
        click("abrir modal");
        await settle();
        expect(window.history.length).toBe(baseLength + 2);

        await pressBack();
        expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
        expect(screen.getByTestId("drawer")).toBeInTheDocument();

        await pressBack();
        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
        expect(window.history.state).toEqual({ __NA: true, tree: "page" });
    });

    it("removes the entry when the UI closes the overlay, without closing the one below", async () => {
        renderPage();
        click("abrir drawer");
        await settle();
        const drawerState = window.history.state;
        click("abrir modal");
        await settle();
        const back = vi.spyOn(window.history, "back");

        click("cerrar modal");
        await settle();

        expect(back).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("drawer")).toBeInTheDocument();
        expect(window.history.state).toEqual(drawerState);

        click("cerrar drawer");
        await settle();
        expect(back).toHaveBeenCalledTimes(2);
        expect(window.history.state).toEqual({ __NA: true, tree: "page" });
    });

    it("removes the entry when Escape closes the overlay", async () => {
        renderPage();
        click("abrir drawer");
        await settle();

        act(() => {
            screen.getByTestId("drawer").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        });
        await settle();

        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
        expect(window.history.state).toEqual({ __NA: true, tree: "page" });
    });

    it("never undoes a navigation that pushed its own entry before the overlay closed", async () => {
        const { unmount } = renderPage();
        click("abrir drawer");
        await settle();
        const back = vi.spyOn(window.history, "back");
        const go = vi.spyOn(window.history, "go");

        act(() => window.history.pushState({ __NA: true, tree: "other-page" }, "", "/other"));
        unmount();
        await settle();

        expect(back).not.toHaveBeenCalled();
        expect(go).not.toHaveBeenCalled();
        expect(window.history.state).toEqual({ __NA: true, tree: "other-page" });
        window.history.replaceState({ __NA: true, tree: "page" }, "", "/");
    });

    it("keeps a single entry through StrictMode's double mount", async () => {
        const push = vi.spyOn(window.history, "pushState");
        const back = vi.spyOn(window.history, "back");
        const go = vi.spyOn(window.history, "go");
        render(<StrictMode><FocusTrapProvider dismissOnBack><Page /></FocusTrapProvider></StrictMode>);

        click("abrir drawer");
        await settle();

        expect(push).toHaveBeenCalledTimes(1);
        expect(back).not.toHaveBeenCalled();
        expect(go).not.toHaveBeenCalled();
        expect(window.history.length).toBe(baseLength + 1);
        expect(screen.getByTestId("drawer")).toBeInTheDocument();

        await pressBack();
        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
    });

    it("reuses the entry when one overlay replaces another in the same render", async () => {
        function Swap() {
            const [ which, setWhich ] = useState<"a" | "b" | null>(null);
            return (
                <>
                    <button type="button" onClick={() => setWhich("a")}>abrir a</button>
                    {which === "a" && <Overlay key="a" name="a" onClose={() => setWhich(null)} />}
                    {which === "a" && <button type="button" onClick={() => setWhich("b")}>ir a b</button>}
                    {which === "b" && <Overlay key="b" name="b" onClose={() => setWhich(null)} />}
                </>
            );
        }
        renderPage(<Swap />);
        click("abrir a");
        await settle();
        click("ir a b");
        await settle();

        expect(window.history.length).toBe(baseLength + 1);
        await pressBack();
        expect(screen.queryByTestId("b")).not.toBeInTheDocument();
        expect(window.history.state).toEqual({ __NA: true, tree: "page" });
    });

    it("puts the entry back when the overlay refuses to close on Back", async () => {
        function Busy() {
            const [ open, setOpen ] = useState(false);
            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>abrir</button>
                    {open && <Overlay name="busy" onClose={() => undefined} />}
                </>
            );
        }
        renderPage(<Busy />);
        click("abrir");
        await settle();

        await pressBack();

        expect(screen.getByTestId("busy")).toBeInTheDocument();
        expect(typeof window.history.state.overlay).toBe("string");
    });

    it("gives no entry to a trap without a close handler", async () => {
        const push = vi.spyOn(window.history, "pushState");
        renderPage(<Page withEscape={false} />);
        click("abrir drawer");
        await settle();

        expect(push).not.toHaveBeenCalled();
    });

    it("still locks body scroll while an overlay is open", async () => {
        renderPage();
        click("abrir drawer");
        await settle();
        expect(document.body.style.position).toBe("fixed");

        await pressBack();
        expect(document.body.style.position).toBe("");
    });

    it("never touches history without dismissOnBack (public pages)", async () => {
        const push = vi.spyOn(window.history, "pushState");
        const back = vi.spyOn(window.history, "back");
        renderPage(<Page />, false);
        click("abrir drawer");
        await settle();
        click("cerrar drawer");
        await settle();
        click("abrir drawer");
        await settle();

        act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
        await settle();

        expect(push).not.toHaveBeenCalled();
        expect(back).not.toHaveBeenCalled();
        expect(screen.getByTestId("drawer")).toBeInTheDocument();
    });
    it("never goes back for an overlay whose page unmounted before its navigation committed", async () => {
        function ScopedPage() {
            useBackScope();
            return <Page />;
        }
        function App() {
            const [ signedIn, setSignedIn ] = useState(true);
            return (
                <>
                    <button type="button" onClick={() => setSignedIn(false)}>salir</button>
                    {signedIn && <ScopedPage />}
                </>
            );
        }
        renderPage(<App />);
        click("abrir drawer");
        await settle();
        const overlayState = window.history.state;
        const back = vi.spyOn(window.history, "back");
        const go = vi.spyOn(window.history, "go");

        click("salir");
        await settle();

        expect(back).not.toHaveBeenCalled();
        expect(go).not.toHaveBeenCalled();
        expect(window.history.state).toEqual(overlayState);
    });

    it("still goes back when the UI closes an overlay on a page that stays", async () => {
        function ScopedPage() {
            useBackScope();
            return <Page />;
        }
        renderPage(<ScopedPage />);
        click("abrir drawer");
        await settle();

        click("cerrar drawer");
        await settle();

        expect(window.history.state).toEqual({ __NA: true, tree: "page" });
    });

    it("removes both entries when two overlays close from the UI in quick succession", async () => {
        renderPage();
        click("abrir drawer");
        await settle();
        click("abrir modal");
        await settle();

        const traverse = window.history.back.bind(window.history);
        const back = vi.spyOn(window.history, "back").mockImplementation(() => { setTimeout(traverse, 30); });

        click("cerrar modal");
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
        expect(back).toHaveBeenCalledTimes(1);
        click("cerrar drawer");
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
        await settle();

        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
        expect(window.history.state).toEqual({ __NA: true, tree: "page" });
    });

    describe("scroll position", () => {
        let scroll: ReturnType<typeof installScrollRestorationModel>;
        beforeEach(() => {
            scroll = installScrollRestorationModel(640);
        });
        afterEach(() => scroll.restore());

        it("is kept when the UI closes the overlay", async () => {
            renderPage();
            click("abrir drawer");
            await settle();

            click("cerrar drawer");
            await settle();

            expect(window.history.state).toEqual({ __NA: true, tree: "page" });
            expect(scroll.y).toBe(640);
        });

        it("is kept when Back closes the overlay", async () => {
            renderPage();
            click("abrir drawer");
            await settle();

            await pressBack();

            expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
            expect(scroll.y).toBe(640);
        });
    });
});
