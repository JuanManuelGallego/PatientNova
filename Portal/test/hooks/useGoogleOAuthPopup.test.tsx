import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGoogleOAuthPopup } from "@/src/hooks/useGoogleOAuthPopup";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useGoogleOAuthPopup", () => {
  it("reports a blocked popup", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const { result } = renderHook(() => useGoogleOAuthPopup(vi.fn()));

    await act(() => result.current.openOAuth(async () => ({ authUrl: "https://accounts.google.test" })));

    expect(result.current.error).toMatch(/Configuración/);
  });

  it("accepts only the expected origin and popup, and processes completion once", async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: "" } } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    const onComplete = vi.fn();
    const { result } = renderHook(() => useGoogleOAuthPopup(onComplete));
    await act(() => result.current.openOAuth(async () => ({ authUrl: "https://accounts.google.test" })));

    act(() => window.dispatchEvent(new MessageEvent("message", {
      origin: "https://attacker.test",
      source: popup,
      data: { type: "GOOGLE_OAUTH_COMPLETE", success: true },
    })));
    act(() => window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      source: window,
      data: { type: "GOOGLE_OAUTH_COMPLETE", success: true },
    })));
    expect(onComplete).not.toHaveBeenCalled();

    const completion = new MessageEvent("message", {
      origin: window.location.origin,
      source: popup,
      data: { type: "GOOGLE_OAUTH_COMPLETE", success: true },
    });
    act(() => window.dispatchEvent(completion));
    act(() => window.dispatchEvent(completion));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(popup.close).toHaveBeenCalledTimes(1);
  });

  it("reports a popup closed before OAuth starts", async () => {
    const popup = { closed: true, close: vi.fn(), location: { href: "" } } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    const { result } = renderHook(() => useGoogleOAuthPopup(vi.fn()));

    await act(() => result.current.openOAuth(async () => ({ authUrl: "https://accounts.google.test" })));

    expect(result.current.error).toMatch(/Configuración/);
  });
});
