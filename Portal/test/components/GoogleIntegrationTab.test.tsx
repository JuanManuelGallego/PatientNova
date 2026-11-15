import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleIntegrationTab as Tab } from "@/src/components/Settings/GoogleIntegrationTab";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { ApiMutationError } from "@/src/api/base/useApiMutation";
import type { GoogleConnectionStatus } from "@/src/types/Google";

let connectionState: { data?: Partial<GoogleConnectionStatus>; loading: boolean; error: string | null };
let role = "ADMIN";
const fetchConnection = vi.fn();
const verifyConnection = vi.fn();
const openOAuth = vi.fn();
const startOAuth = vi.fn();
const disconnect = vi.fn();
const reportAttention = vi.fn();

const GoogleIntegrationTab = () => <FocusTrapProvider><Tab /></FocusTrapProvider>;
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
  useDisconnectGoogle: () => ({ disconnect, loading: false, error: null }),
}));
vi.mock("@/src/hooks/useGoogleOAuthPopup", () => ({
  useGoogleOAuthPopup: () => ({ openOAuth, waiting: false, error: null }),
}));
vi.mock("@/src/providers/SettingsAttentionContext", () => ({
  useSettingsAttention: () => ({ sections: new Set(), report: reportAttention }),
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
  disconnect.mockReset().mockResolvedValue(undefined);
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
    expect(startOAuth).toHaveBeenCalledWith("/settings/integrations", true);
    unmount();

    connectionState.data = { status: "not_connected", connected: false };
    render(<GoogleIntegrationTab />);
    expect(screen.getByTestId("google-connection-heading")).toHaveTextContent("Cuenta de Google no conectada");
    expect(screen.getByTestId("google-connect-button")).toBeInTheDocument();
    expect(screen.queryByTestId("google-reconnect-button")).not.toBeInTheDocument();
  });

  it("asks before disconnecting and disconnects only on confirm", async () => {
    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);
    await userEvent.click(screen.getByTestId("google-disconnect-button"));

    expect(screen.getByTestId("google-disconnect-dialog")).toBeInTheDocument();
    expect(disconnect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId("google-disconnect-dialog-confirm-button"));
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(fetchConnection).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("google-disconnect-dialog")).toBeNull();
  });

  it("keeps the account connected when the dialog is cancelled", async () => {
    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);
    await userEvent.click(screen.getByTestId("google-disconnect-button"));
    await userEvent.click(screen.getByTestId("google-disconnect-dialog-cancel-button"));

    expect(screen.queryByTestId("google-disconnect-dialog")).toBeNull();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with the error when disconnecting fails", async () => {
    disconnect.mockRejectedValue(new ApiMutationError("No se pudo desconectar", 500));
    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);
    await userEvent.click(screen.getByTestId("google-disconnect-button"));
    await userEvent.click(screen.getByTestId("google-disconnect-dialog-confirm-button"));

    expect(screen.getByTestId("google-disconnect-dialog")).toHaveTextContent("No se pudo desconectar");
    expect(screen.getByTestId("google-disconnect-dialog-confirm-button")).toBeEnabled();
  });

  it("says the connection failed instead of the browser's English text", async () => {
    disconnect.mockRejectedValue(new TypeError("Failed to fetch"));
    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);
    await userEvent.click(screen.getByTestId("google-disconnect-button"));
    await userEvent.click(screen.getByTestId("google-disconnect-dialog-confirm-button"));

    const dialog = screen.getByTestId("google-disconnect-dialog");
    expect(dialog).toHaveTextContent("No pudimos conectar con el servidor. Revisa tu conexión a internet.");
    expect(dialog).not.toHaveTextContent("Failed to fetch");
  });

  it("stays open while disconnecting, so a late failure is still shown", async () => {
    let fail: (e: Error) => void = () => {};
    disconnect.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);
    await userEvent.click(screen.getByTestId("google-disconnect-button"));
    await userEvent.click(screen.getByTestId("google-disconnect-dialog-confirm-button"));

    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("google-disconnect-dialog")).toBeInTheDocument();

    await act(async () => fail(new ApiMutationError("No se pudo desconectar", 500)));
    expect(screen.getByTestId("google-disconnect-dialog")).toHaveTextContent("No se pudo desconectar");
  });

  it("tells the menu whether Google needs attention", () => {
    connectionState.data = { status: "expired", connected: false };
    const { unmount } = render(<GoogleIntegrationTab />);
    expect(reportAttention).toHaveBeenLastCalledWith({ integrations: true });
    unmount();

    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);
    expect(reportAttention).toHaveBeenLastCalledWith({ integrations: false });
  });

  it("never uses the browser's confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);
    await userEvent.click(screen.getByTestId("google-disconnect-button"));
    await userEvent.click(screen.getByTestId("google-disconnect-dialog-confirm-button"));

    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("frames the integration as the Google Meet section", () => {
    connectionState.data = { status: "connected", connected: true };
    render(<GoogleIntegrationTab />);
    expect(screen.getByRole("region", { name: "Google Meet" })).toBeInTheDocument();
  });
});
