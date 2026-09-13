import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleOAuthCompletePage from "@/src/app/google/oauth-complete/page";

let params = new URLSearchParams();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

describe("GoogleOAuthCompletePage", () => {
  beforeEach(() => {
    params = new URLSearchParams();
    push.mockReset();
    vi.restoreAllMocks();
  });

  it("messages its opener and closes after successful authorization", async () => {
    params = new URLSearchParams("success=true&returnPath=%2Fappointments");
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, "opener", { configurable: true, value: opener });
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);

    render(<GoogleOAuthCompletePage />);

    await waitFor(() => expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "GOOGLE_OAUTH_COMPLETE", success: true }),
      window.location.origin,
    ));
    expect(close).toHaveBeenCalled();
  });

  it("shows the completion result when opened without an opener", async () => {
    params = new URLSearchParams("success=false&error=scope_missing");
    Object.defineProperty(window, "opener", { configurable: true, value: null });
    render(<GoogleOAuthCompletePage />);

    expect(await screen.findByText("Authorization failed")).toBeInTheDocument();
    expect(screen.getByText(/permission was not granted/)).toBeInTheDocument();
  });
});
