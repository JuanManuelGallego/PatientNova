import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderAlerts } from "@/src/components/Info/ProviderAlerts";
import type { GoogleConnectionStatus } from "@/src/types/Google";

let role: string | undefined = "ADMIN";
let portalEnabled = false;
let connection: Partial<GoogleConnectionStatus> | undefined;
let needsLink: { count: number; appointments: { id: string; startAt: string }[] } | undefined;
const useFetchNeedsMeetingLink = vi.fn();
const fetchConnection = vi.fn();
const startOAuth = vi.fn();
const useFetchGoogleConnection = vi.fn();

vi.mock("@/src/providers/AuthContext", () => ({
  useAuthContext: () => ({ user: role ? { role, portalEnabled } : null }),
}));
vi.mock("@/src/api/appointments/useFetchNeedsMeetingLink", () => ({
  useFetchNeedsMeetingLink: (...args: unknown[]) => useFetchNeedsMeetingLink(...args),
}));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/api/google/useFetchGoogleConnection", () => ({
  useFetchGoogleConnection: (...args: unknown[]) => useFetchGoogleConnection(...args),
}));
vi.mock("@/src/api/google/useStartGoogleOAuth", () => ({
  useStartGoogleOAuth: () => ({ startOAuth, loading: false, error: null }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  role = "ADMIN";
  portalEnabled = false;
  connection = undefined;
  needsLink = undefined;
  useFetchNeedsMeetingLink.mockReset().mockImplementation(() => ({ data: needsLink, loading: false, error: null, refetch: vi.fn() }));
  fetchConnection.mockReset().mockResolvedValue(undefined);
  startOAuth.mockReset().mockResolvedValue({ authUrl: "https://accounts.google.test" });
  useFetchGoogleConnection.mockReset().mockImplementation(() => ({
    data: connection, loading: false, error: null, fetchConnection,
  }));
});

describe("ProviderAlerts: online bookings without a video-call link", () => {
  it("tells admins how many online bookings need a link, and when the next one is", () => {
    portalEnabled = true;
    needsLink = { count: 2, appointments: [ { id: "a1", startAt: "2099-01-20T15:00:00.000Z" }, { id: "a2", startAt: "2099-01-21T15:00:00.000Z" } ] };
    render(<ProviderAlerts />);
    const banner = screen.getByTestId("needs-meeting-link-banner");
    expect(banner).toHaveTextContent("2 citas reservadas en línea necesitan un enlace de videollamada.");
    expect(banner).toHaveTextContent(/La próxima es el .*20.*enero.*2099 a las 10:00 a\. m\./);
    expect(screen.getByRole("link", { name: "Ver citas" })).toHaveAttribute("href", "/appointments");
  });

  it("uses the singular for one and hides when none", () => {
    portalEnabled = true;
    needsLink = { count: 1, appointments: [ { id: "a1", startAt: "2099-01-20T15:00:00.000Z" } ] };
    const { unmount } = render(<ProviderAlerts />);
    expect(screen.getByTestId("needs-meeting-link-banner")).toHaveTextContent("1 cita reservada en línea necesita un enlace");
    unmount();
    needsLink = { count: 0, appointments: [] };
    render(<ProviderAlerts />);
    expect(screen.queryByTestId("needs-meeting-link-banner")).not.toBeInTheDocument();
  });

  it("never asks for it with the portal off or for viewers", () => {
    render(<ProviderAlerts />);
    expect(useFetchNeedsMeetingLink).not.toHaveBeenCalled();
    portalEnabled = true;
    role = "VIEWER";
    render(<ProviderAlerts />);
    expect(useFetchNeedsMeetingLink).not.toHaveBeenCalled();
  });
});

describe("ProviderAlerts", () => {
  it("shows the expired-Google banner to admins", () => {
    connection = { status: "expired", connected: false };
    render(<ProviderAlerts />);
    expect(screen.getByTestId("google-expired-banner")).toHaveTextContent("Tu conexión con Google expiró");
    expect(screen.getByRole("region", { name: /Tu conexión con Google expiró/ })).toBeInTheDocument();
    expect(screen.getByTestId("google-expired-reconnect")).toHaveTextContent("Reconectar Google");
  });

  it("offers providers who don't use Meet a way to the integration settings", () => {
    connection = { status: "expired", connected: false };
    render(<ProviderAlerts />);
    const link = screen.getByRole("link", { name: "No uso Google Meet" });
    expect(link).toHaveAttribute("href", "/settings?tab=Integraciones");
  });

  it("is not a live region, so it isn't re-announced on every page", () => {
    connection = { status: "expired", connected: false };
    render(<ProviderAlerts />);
    const banner = screen.getByTestId("google-expired-banner");
    expect(banner).not.toHaveAttribute("role", "status");
    expect(banner).not.toHaveAttribute("aria-live");
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
