import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DrawerShell, LinkedCard } from "@/src/components/Drawers/DrawerUtils";
import { DETAIL_ICONS } from "@/src/config/icons";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <FocusTrapProvider>
      <button type="button" onClick={() => setOpen(true)}>Abrir cita</button>
      {open && (
        <DrawerShell
          title="Consulta inicial"
          eyebrow="Detalles de la cita"
          icon={DETAIL_ICONS.calendar}
          onClose={() => setOpen(false)}
          panelTestId="test-drawer"
          closeTestId="test-drawer-close"
        >
          <button type="button">Acción</button>
        </DrawerShell>
      )}
    </FocusTrapProvider>
  );
}

describe("DrawerShell", () => {
  it("exposes dialog semantics, closes on Escape, and restores focus", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    const opener = screen.getByRole("button", { name: "Abrir cita" });

    await user.click(opener);

    expect(screen.getByRole("dialog", { name: "Consulta inicial" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar panel" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Abrir cita" }));

    await user.click(document.querySelector(".drawer-backdrop")!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("LinkedCard", () => {
  it("uses native button keyboard behavior when interactive", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<LinkedCard onClick={onClick}>Cita vinculada</LinkedCard>);

    const card = screen.getByRole("button", { name: /Cita vinculada/ });
    card.focus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledOnce();
  });
});
