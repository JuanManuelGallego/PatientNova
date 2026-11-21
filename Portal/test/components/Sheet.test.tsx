import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "@/src/components/Sheet/Sheet";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

function renderSheet(props: Partial<Parameters<typeof Sheet>[ 0 ]> = {}) {
    const onClose = vi.fn();
    render(
        <FocusTrapProvider>
            <Sheet title="Filtros" onClose={onClose} {...props}>
                <button type="button">Dentro</button>
            </Sheet>
        </FocusTrapProvider>,
    );
    return { onClose, user: userEvent.setup() };
}

function drag(from: number, to: number) {
    const handle = screen.getByTestId("sheet-handle");
    fireEvent.pointerDown(handle, { clientY: from });
    fireEvent.pointerMove(handle, { clientY: to });
    fireEvent.pointerUp(handle, { clientY: to });
}

beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe("Sheet", () => {
    it("shows its title as the dialog's heading", () => {
        renderSheet();
        expect(screen.getByRole("heading", { name: "Filtros" })).toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument();
    });

    it("keeps the title for screen readers only with hideTitle", () => {
        renderSheet({ hideTitle: true });
        expect(screen.queryByRole("heading")).toBeNull();
        expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument();
    });

    it("renders the footer below the content", () => {
        renderSheet({ footer: <button type="button">Aplicar</button> });
        const content = screen.getByRole("button", { name: "Dentro" });
        const action = screen.getByRole("button", { name: "Aplicar" });
        expect(content.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("moves focus inside when it opens", () => {
        renderSheet();
        expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    });

    it("calls onClose from the close button", async () => {
        const { onClose, user } = renderSheet();
        await user.click(screen.getByRole("button", { name: "Cerrar" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose on Esc", async () => {
        const { onClose, user } = renderSheet();
        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when tapping outside, not inside", async () => {
        const { onClose, user } = renderSheet();
        await user.click(screen.getByRole("button", { name: "Dentro" }));
        expect(onClose).not.toHaveBeenCalled();
        await user.click(screen.getByTestId("sheet-scrim"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose on a downward drag past 80px", () => {
        const { onClose } = renderSheet();
        drag(100, 190);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("springs back on a shorter drag", () => {
        const { onClose } = renderSheet();
        drag(100, 150);
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog").style.transform).toBe("");
    });

    it("locks the page while open, under the provider app's registry", () => {
        renderSheet();
        expect(document.body.style.position).toBe("fixed");
    });
});
