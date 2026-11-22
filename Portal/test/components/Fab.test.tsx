import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Fab } from "@/src/components/Fab";
import { PHONE_MEDIA_QUERY } from "@/src/hooks/usePhoneLayout";

const originalMatchMedia = window.matchMedia;

/** Only the phone query matches, as on a screen narrower than 640px. */
function stubPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === PHONE_MEDIA_QUERY,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("Fab", () => {
  it("renders nothing on a wider screen, and nothing where matchMedia matches nothing", () => {
    render(<Fab label="Nueva cita" onClick={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Nueva cita" })).toBeNull();

    stubPhone(false);
    render(<Fab label="Nueva cita" onClick={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Nueva cita" })).toBeNull();
  });

  it("on a phone shows one named button that runs its action, and reserves room under the page", () => {
    stubPhone(true);
    const onClick = vi.fn();
    const { container } = render(<Fab label="Nueva cita" onClick={onClick} testId="fab" />);

    const button = screen.getByRole("button", { name: "Nueva cita" });
    expect(button).toHaveAttribute("data-testid", "fab");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    // The spacer stays in the page flow, so the last card can scroll clear of the button.
    expect(container.querySelector("[data-fab-spacer]")).not.toBeNull();
  });
});
