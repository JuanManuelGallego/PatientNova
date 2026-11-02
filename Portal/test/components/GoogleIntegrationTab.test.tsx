import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleIntegrationTab } from "@/src/components/Settings/GoogleIntegrationTab";
import type { GoogleConnectionStatus } from "@/src/types/Google";

let connectionState: { data?: Partial<GoogleConnectionStatus>; loading: boolean; error: string | null };
let role = "ADMIN";
const fetchConnection = vi.fn();
const verifyConnection = vi.fn();
const openOAuth = vi.fn();
const startOAuth = vi.fn();
let verifyError: string | null = null;

vi.mock("@/src/api/google/useFetchGoogleConnection", () => ({
  useFetchGoogleConnection: () => ({ ...connectionState, fetchConnection }),
}));
vi.mock("@/src/api/google/useVerifyGoogleConnection", () => ({
  useVerifyGoogleConnection: () => ({ verifyConnection, loading: false, error: verifyError }),
}));
vi.mock("@/src/api/google/useStartGoogleOAuth", () => ({
  useStartGoogleOAuth: () => ({ startOAuth, loading: false, error: null }),
}));
vi.mock("@/src/api/google/useDisconnectGoogle", () => ({
  useDisconnectGoogle: () => ({ disconnect: vi.fn(), loading: false, error: null }),
}));
vi.mock("@/src/hooks/useGoogleOAuthPopup", () => ({
  useGoogleOAuthPopup: () => ({ openOAuth, waiting: false, error: null }),
}));
vi.mock("@/src/providers/AuthContext", () => ({
  useAuthContext: () => ({ user: { role } }),
}));

beforeEach(() => {
  role = "ADMIN";
  verifyError = null;
  connectionState = { loading: false, error: null };
  fetchConnection.mockReset().mockResolvedValue(undefined);
  verifyConnection.mockReset().mockResolvedValue({ status: "connected", connected: true });
  openOAuth.mockReset().mockImplementation(async (getAuthUrl: () => Promise<unknown>) => { await getAuthUrl(); return true; });
  startOAuth.mockReset().mockResolvedValue({ authUrl: "https://accounts.google.test" });
});

describe("GoogleIntegrationTab", () => {
  it("renders an explicit unknown/loading state", () => {
    connectionState.loading = true;
    render(<GoogleIntegrationTab />);
    expect(screen.getByText(/Comprobando conexión con Google/)).toBeInTheDocument();
  });

  it("renders connection errors without pretending the account is disconnected", () => {
    connectionState.error = "No disponible";
    render(<GoogleIntegrationTab />);
    expect(screen.getByText("No se pudo comprobar la conexión")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No disponible");
  });

  it("shows connected status and mutation controls to viewers", () => {
    role = "VIEWER";
    connectionState.data = { status: "connected", connected: true, connectedAt: "2026-09-13T10:00:00.000Z" };
    render(<GoogleIntegrationTab />);
    expect(screen.getByText("Cuenta de Google conectada")).toBeInTheDocument();
    expect(screen.getByTestId("google-reconnect-button")).toBeInTheDocument();
    expect(screen.getByTestId("google-disconnect-button")).toBeInTheDocument();
  });

  it("shows when the connection was last checked, or that no check ran yet", () => {
    connectionState.data = { status: "connected", connected: true, lastCheckedAt: null };
    const { unmount } = render(<GoogleIntegrationTab />);
    expect(screen.getByTestId("google-last-checked")).toHaveTextContent("Aún no verificada");
    unmount();

    connectionState.data = { status: "connected", connected: true, lastCheckedAt: "2026-11-02T11:00:00.000Z" };
    render(<GoogleIntegrationTab />);
    expect(screen.getByTestId("google-last-checked")).not.toHaveTextContent("Aún no verificada");
  });

  it("'Verificar ahora' checks with Google, confirms it, then reloads the status", async () => {
    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);
    expect(screen.getByTestId("google-verified-notice")).toBeEmptyDOMElement();

    await userEvent.click(screen.getByTestId("google-verify-button"));

    expect(verifyConnection).toHaveBeenCalledTimes(1);
    expect(fetchConnection).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("google-verified-notice")).toHaveTextContent("Conexión verificada.");
  });

  it("does not confirm a check that found the connection expired", async () => {
    verifyConnection.mockResolvedValue({ status: "expired", connected: false });
    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);

    await userEvent.click(screen.getByTestId("google-verify-button"));

    expect(screen.getByTestId("google-verified-notice")).toBeEmptyDOMElement();
  });

  it("reports a refused check (e.g. too many) without losing the status", async () => {
    verifyError = "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.";
    verifyConnection.mockRejectedValue(new Error("429"));
    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);

    expect(screen.getByRole("alert")).toHaveTextContent("Demasiadas solicitudes");
    await userEvent.click(screen.getByTestId("google-verify-button"));
    expect(screen.getByText("Cuenta de Google conectada")).toBeInTheDocument();
  });

  it("distinguishes an expired connection from one never made", async () => {
    connectionState.data = { status: "expired", connected: false, disconnectedAt: "2026-11-01T11:00:00.000Z" };
    const { unmount } = render(<GoogleIntegrationTab />);
    expect(screen.getByTestId("google-connection-heading")).toHaveTextContent("La conexión con Google expiró");
    // The formatted time ends in "a. m."/"p. m.", so it closes the sentence: never a full stop after it.
    const detail = screen.getByText(/Reconéctala para seguir generando enlaces de Meet\. Google dejó de aceptarla el/);
    expect(detail.textContent).toMatch(/[ap]\. m\.$/);
    expect(screen.getByText(/¿No usas Google Meet\?/)).toBeInTheDocument();
    expect(screen.queryByTestId("google-connect-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("google-verify-button")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("google-reconnect-button"));
    expect(startOAuth).toHaveBeenCalledWith("/settings", true);
    unmount();

    connectionState.data = { status: "not_connected", connected: false };
    render(<GoogleIntegrationTab />);
    expect(screen.getByTestId("google-connection-heading")).toHaveTextContent("Cuenta de Google no conectada");
    expect(screen.getByTestId("google-connect-button")).toBeInTheDocument();
    expect(screen.queryByTestId("google-reconnect-button")).not.toBeInTheDocument();
  });
});
