import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderAlerts } from "@/src/components/Info/ProviderAlerts";
import type { GoogleConnectionStatus } from "@/src/types/Google";

let role: string | undefined = "ADMIN";
let connection: Partial<GoogleConnectionStatus> | undefined;
const fetchConnection = vi.fn();
const startOAuth = vi.fn();
const useFetchGoogleConnection = vi.fn();

vi.mock("@/src/providers/AuthContext", () => ({
  useAuthContext: () => ({ user: role ? { role } : null }),
}));
vi.mock("@/src/api/google/useFetchGoogleConnection", () => ({
  useFetchGoogleConnection: (...args: unknown[]) => useFetchGoogleConnection(...args),
}));
vi.mock("@/src/api/google/useStartGoogleOAuth", () => ({
  useStartGoogleOAuth: () => ({ startOAuth, loading: false, error: null }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  role = "ADMIN";
  connection = undefined;
  fetchConnection.mockReset().mockResolvedValue(undefined);
  startOAuth.mockReset().mockResolvedValue({ authUrl: "https://accounts.google.test" });
  useFetchGoogleConnection.mockReset().mockImplementation(() => ({
    data: connection, loading: false, error: null, fetchConnection,
  }));
});

describe("ProviderAlerts", () => {
  it("shows the expired-Google banner to admins", () => {
    connection = { status: "expired", connected: false };
    render(<ProviderAlerts />);
    expect(screen.getByTestId("google-expired-banner")).toHaveTextContent("Tu conexión con Google expiró");
  });

  it.each([ "connected", "not_connected" ] as const)("shows nothing when the connection is %s", (status) => {
    connection = { status, connected: status === "connected" };
    const { container } = render(<ProviderAlerts />);
    expect(container).toBeEmptyDOMElement();
  });

  it("never asks viewers (or a signed-out page) for the connection", () => {
    for (const r of [ "VIEWER", undefined ]) {
      role = r;
      const { container, unmount } = render(<ProviderAlerts />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
    expect(useFetchGoogleConnection).not.toHaveBeenCalled();
  });

  it("reconnects with consent and refreshes the status when Google confirms", async () => {
    connection = { status: "expired", connected: false };
    const popup = { closed: false, close: vi.fn(), location: { href: "" } } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    render(<ProviderAlerts />);

    await userEvent.click(screen.getByTestId("google-expired-reconnect"));
    expect(startOAuth).toHaveBeenCalledWith("/settings", true);

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: window.location.origin,
        source: popup,
        data: { type: "GOOGLE_OAUTH_COMPLETE", success: true },
      }));
    });
    await waitFor(() => expect(fetchConnection).toHaveBeenCalledTimes(1));
  });

  it("shows a failed reconnect inside the banner", async () => {
    connection = { status: "expired", connected: false };
    const popup = { closed: false, close: vi.fn(), location: { href: "" } } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    render(<ProviderAlerts />);

    await userEvent.click(screen.getByTestId("google-expired-reconnect"));
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: window.location.origin,
        source: popup,
        data: { type: "GOOGLE_OAUTH_COMPLETE", success: false, error: "Permiso denegado" },
      }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Permiso denegado");
    expect(fetchConnection).not.toHaveBeenCalled();
  });
});
