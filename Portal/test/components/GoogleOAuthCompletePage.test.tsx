import { render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleOAuthCompletePage from "@/src/app/google/oauth-complete/page";

let params = new URLSearchParams();
const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => params,
}));

describe("GoogleOAuthCompletePage", () => {
  beforeEach(() => {
    params = new URLSearchParams();
    push.mockReset();
    replace.mockReset();
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("messages its opener and closes after successful authorization", async () => {
    vi.useFakeTimers();
    params = new URLSearchParams("success=true&returnPath=%2Fappointments");
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, "opener", { configurable: true, value: opener });
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);

    await act(async () => { render(<GoogleOAuthCompletePage />); });

    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "GOOGLE_OAUTH_COMPLETE", success: true }),
      window.location.origin,
    );
    expect(close).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(close).toHaveBeenCalled();
  });

  it("shows the completion result when opened without an opener", async () => {
    params = new URLSearchParams("success=false&error=scope_missing");
    Object.defineProperty(window, "opener", { configurable: true, value: null });
    render(<GoogleOAuthCompletePage />);

    expect(await screen.findByText("No se pudo conectar Google")).toBeInTheDocument();
    expect(screen.getByText(/No se concedió el permiso de Google Meet/)).toBeInTheDocument();
  });

  it("returns to the starting page after a redirect-flow success", async () => {
    params = new URLSearchParams("success=true&returnPath=%2Fsettings%2Fintegrations");
    Object.defineProperty(window, "opener", { configurable: true, value: null });
    sessionStorage.setItem("patientnova-google-oauth-redirect", "1");
    await act(async () => { render(<GoogleOAuthCompletePage />); });

    expect(replace).toHaveBeenCalledWith("/settings/integrations");
    expect(sessionStorage.getItem("patientnova-google-oauth-redirect")).toBeNull();
  });

  it("offers only 'Volver a Patient Nova' after a redirect-flow error", async () => {
    params = new URLSearchParams("success=false&error=callback_failed");
    Object.defineProperty(window, "opener", { configurable: true, value: null });
    sessionStorage.setItem("patientnova-google-oauth-redirect", "1");
    render(<GoogleOAuthCompletePage />);

    const back = await screen.findByRole("button", { name: "Volver a Patient Nova" });
    expect(screen.queryByRole("button", { name: "Cerrar ventana" })).toBeNull();
    act(() => back.click());
    expect(replace).toHaveBeenCalledWith("/settings/integrations");
  });
});
