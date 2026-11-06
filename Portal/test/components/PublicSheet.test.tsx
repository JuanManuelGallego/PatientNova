import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicSheet } from "@/src/components/PublicBooking/PublicSheet";
import { useHistoryOverlay } from "@/src/hooks/useHistoryOverlay";

function Harness() {
    const overlay = useHistoryOverlay("profile");
    return (
        <>
            <button type="button" onClick={overlay.show}>Abrir</button>
            {overlay.open && <PublicSheet title="Perfil" onClose={overlay.hide}><button type="button">Dentro</button></PublicSheet>}
        </>
    );
}

async function open() {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    return { user, dialog: screen.getByRole("dialog", { name: "Perfil" }) };
}

const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "");
});

describe("PublicSheet", () => {
    it("moves focus inside when it opens", async () => {
        const { dialog } = await open();
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });

    it("closes with the back button and returns focus to the opener", async () => {
        await open();
        window.history.back();
        await closed();
        expect(screen.getByRole("button", { name: "Abrir" })).toHaveFocus();
    });

    it("closes with the close button", async () => {
        const { user } = await open();
        await user.click(screen.getByRole("button", { name: "Cerrar" }));
        await closed();
    });

    it("closes with Esc", async () => {
        const { user } = await open();
        await user.keyboard("{Escape}");
        await closed();
    });

    it("closes when tapping outside", async () => {
        const { user } = await open();
        await user.click(screen.getByTestId("sheet-scrim"));
        await closed();
    });

    it("stays open when tapping inside", async () => {
        const { user } = await open();
        await user.click(screen.getByRole("button", { name: "Dentro" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes on a downward drag past 80px", async () => {
        await open();
        const handle = screen.getByTestId("sheet-handle");
        fireEvent.pointerDown(handle, { clientY: 100 });
        fireEvent.pointerMove(handle, { clientY: 190 });
        fireEvent.pointerUp(handle, { clientY: 190 });
        await closed();
    });

    it("stays open on a shorter drag", async () => {
        await open();
        const handle = screen.getByTestId("sheet-handle");
        fireEvent.pointerDown(handle, { clientY: 100 });
        fireEvent.pointerMove(handle, { clientY: 150 });
        fireEvent.pointerUp(handle, { clientY: 150 });
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("unlocks the page when it closes", async () => {
        const { user } = await open();
        expect(document.body.style.position).toBe("fixed");
        await user.click(screen.getByRole("button", { name: "Cerrar" }));
        await closed();
        expect(document.body.style.position).toBe("");
    });

    it("stores only the overlay name in history", async () => {
        await open();
        expect(window.history.state).toEqual({ overlay: "profile" });
    });

    it("keeps what the history entry already held", async () => {
        window.history.replaceState({ bookingStep: "time" }, "");
        await open();
        expect(window.history.state).toEqual({ bookingStep: "time", overlay: "profile" });
    });
});
