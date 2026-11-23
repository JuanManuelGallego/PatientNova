import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OAUTH_REDIRECT_KEY, useGoogleOAuthPopup } from "@/src/hooks/useGoogleOAuthPopup";

const assignLocation = vi.fn();
vi.mock("@/src/utils/browserNavigation", () => ({ assignLocation: (u: string) => assignLocation(u) }));

function stubStandalone() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(display-mode: standalone)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

afterEach(() => {
  assignLocation.mockReset();
  sessionStorage.clear();
  Reflect.deleteProperty(window, "matchMedia");
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

  it("redirects the whole app instead of opening a popup when installed", async () => {
    stubStandalone();
    const open = vi.spyOn(window, "open");
    const { result } = renderHook(() => useGoogleOAuthPopup(vi.fn()));
    expect(result.current.mode).toBe("redirect");

    let started = false;
    await act(async () => { started = await result.current.openOAuth(async () => ({ authUrl: "https://accounts.google.test/auth" })); });

    expect(started).toBe(true);
    expect(open).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(OAUTH_REDIRECT_KEY)).toBe("1");
    expect(assignLocation).toHaveBeenCalledWith("https://accounts.google.test/auth");
  });

  it("reports a failed start in redirect mode without navigating", async () => {
    stubStandalone();
    const { result } = renderHook(() => useGoogleOAuthPopup(vi.fn()));
    await act(async () => { await result.current.openOAuth(async () => { throw new Error("sin conexión"); }); });

    expect(result.current.error).toBe("sin conexión");
    expect(assignLocation).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(OAUTH_REDIRECT_KEY)).toBeNull();
  });
});
