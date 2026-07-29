import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ReactNode } from "react";
import { FocusTrapProvider, useFocusTrap } from "@/src/hooks/useFocusTrap";

function wrapper({ children }: { children: ReactNode }) {
  return <FocusTrapProvider>{children}</FocusTrapProvider>;
}

function makeKeyboardEvent(
  key: string,
  opts: Partial<KeyboardEventInit> = {},
): React.KeyboardEvent {
  return {
    key,
    shiftKey: opts.shiftKey ?? false,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

describe("FocusTrapProvider + useFocusTrap", () => {
  beforeEach(() => {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.overflow = "";
  });

  it("throws when useFocusTrap is used outside FocusTrapProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useFocusTrap());
    }).toThrow("useFocusTrap must be used within a FocusTrapProvider");
    consoleError.mockRestore();
  });

  it("returns ref and handleKeyDown function", () => {
    const { result } = renderHook(() => useFocusTrap(), { wrapper });
    expect(result.current.ref).toBeDefined();
    expect(typeof result.current.handleKeyDown).toBe("function");
  });

  it("calls onEscape when Escape key is pressed", () => {
    const onEscape = vi.fn();
    const { result } = renderHook(() => useFocusTrap(onEscape), { wrapper });

    act(() => {
      result.current.handleKeyDown(makeKeyboardEvent("Escape"));
    });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("stops propagation on Escape", () => {
    const onEscape = vi.fn();
    const { result } = renderHook(() => useFocusTrap(onEscape), { wrapper });
    const event = makeKeyboardEvent("Escape");

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it("does not call onEscape for non-Escape keys", () => {
    const onEscape = vi.fn();
    const { result } = renderHook(() => useFocusTrap(onEscape), { wrapper });

    act(() => {
      result.current.handleKeyDown(makeKeyboardEvent("Enter"));
    });

    expect(onEscape).not.toHaveBeenCalled();
  });

  it("calls preventDefault when Tab is pressed on last focusable element", () => {
    const { result } = renderHook(() => useFocusTrap(), { wrapper });

    const container = document.createElement("div");
    const btn1 = document.createElement("button");
    const btn2 = document.createElement("button");
    container.appendChild(btn1);
    container.appendChild(btn2);
    document.body.appendChild(container);

    (result.current.ref as React.RefObject<HTMLDivElement>).current = container;

    // Mock activeElement to be the last button
    const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "activeElement");
    Object.defineProperty(Document.prototype, "activeElement", {
      get: () => btn2,
      configurable: true,
    });

    const event = makeKeyboardEvent("Tab");
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();

    if (originalDescriptor) {
      Object.defineProperty(Document.prototype, "activeElement", originalDescriptor);
    }
    document.body.removeChild(container);
  });

  it("calls preventDefault when Shift+Tab is pressed on first focusable element", () => {
    const { result } = renderHook(() => useFocusTrap(), { wrapper });

    const container = document.createElement("div");
    const btn1 = document.createElement("button");
    const btn2 = document.createElement("button");
    container.appendChild(btn1);
    container.appendChild(btn2);
    document.body.appendChild(container);

    (result.current.ref as React.RefObject<HTMLDivElement>).current = container;

    const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "activeElement");
    Object.defineProperty(Document.prototype, "activeElement", {
      get: () => btn1,
      configurable: true,
    });

    const event = makeKeyboardEvent("Tab", { shiftKey: true });
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();

    if (originalDescriptor) {
      Object.defineProperty(Document.prototype, "activeElement", originalDescriptor);
    }
    document.body.removeChild(container);
  });

  it("does not prevent default when Tab is pressed on a middle element", () => {
    const { result } = renderHook(() => useFocusTrap(), { wrapper });

    const container = document.createElement("div");
    const btn1 = document.createElement("button");
    const btn2 = document.createElement("button");
    const btn3 = document.createElement("button");
    container.appendChild(btn1);
    container.appendChild(btn2);
    container.appendChild(btn3);
    document.body.appendChild(container);

    (result.current.ref as React.RefObject<HTMLDivElement>).current = container;

    const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "activeElement");
    Object.defineProperty(Document.prototype, "activeElement", {
      get: () => btn2,
      configurable: true,
    });

    const event = makeKeyboardEvent("Tab");
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).not.toHaveBeenCalled();

    if (originalDescriptor) {
      Object.defineProperty(Document.prototype, "activeElement", originalDescriptor);
    }
    document.body.removeChild(container);
  });

  it("ignores Tab when ref has no focusable children", () => {
    const { result } = renderHook(() => useFocusTrap(), { wrapper });

    const container = document.createElement("div");
    document.body.appendChild(container);
    (result.current.ref as React.RefObject<HTMLDivElement>).current = container;

    const event = makeKeyboardEvent("Tab");
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).not.toHaveBeenCalled();

    document.body.removeChild(container);
  });

  it("ignores Tab when ref is null", () => {
    const { result } = renderHook(() => useFocusTrap(), { wrapper });

    // ref.current is null by default
    const event = makeKeyboardEvent("Tab");
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("works without onEscape callback", () => {
    const { result } = renderHook(() => useFocusTrap(), { wrapper });

    // Should not throw
    act(() => {
      result.current.handleKeyDown(makeKeyboardEvent("Escape"));
    });
  });
});
