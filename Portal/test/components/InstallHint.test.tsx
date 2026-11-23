import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallHint } from "@/src/components/Info/InstallHint";

const KEY = "patientnova-install-hint-dismissed";

function setStandalone(v: boolean | undefined) {
  Object.defineProperty(navigator, "standalone", { value: v, configurable: true });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  Reflect.deleteProperty(navigator, "standalone");
  vi.restoreAllMocks();
});

describe("InstallHint", () => {
  it("explains Compartir → Agregar a inicio on iOS Safari", () => {
    setStandalone(false);
    render(<InstallHint />);
    expect(screen.getByText(/Compartir/)).toBeInTheDocument();
    expect(screen.getByText(/Agregar a inicio/)).toBeInTheDocument();
  });

  it.each([ true, undefined ])("stays hidden when navigator.standalone is %s", (v) => {
    setStandalone(v);
    const { container } = render(<InstallHint />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden once dismissed, across remounts", () => {
    setStandalone(false);
    const { unmount, container } = render(<InstallHint />);
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem(KEY)).toBe("1");
    unmount();
    const again = render(<InstallHint />);
    expect(again.container).toBeEmptyDOMElement();
  });

  it("still dismisses for the session when localStorage throws", () => {
    setStandalone(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    const { container } = render(<InstallHint />);
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(container).toBeEmptyDOMElement();
  });
});
