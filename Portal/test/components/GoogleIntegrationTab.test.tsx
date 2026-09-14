import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleIntegrationTab } from "@/src/components/Settings/GoogleIntegrationTab";

let connectionState: { data?: { connected: boolean; connectedAt?: string }; loading: boolean; error: string | null };
let role = "ADMIN";

vi.mock("@/src/api/google/useFetchGoogleConnection", () => ({
  useFetchGoogleConnection: () => ({ ...connectionState, fetchConnection: vi.fn() }),
}));
vi.mock("@/src/api/google/useStartGoogleOAuth", () => ({
  useStartGoogleOAuth: () => ({ startOAuth: vi.fn(), loading: false, error: null }),
}));
vi.mock("@/src/api/google/useDisconnectGoogle", () => ({
  useDisconnectGoogle: () => ({ disconnect: vi.fn(), loading: false, error: null }),
}));
vi.mock("@/src/hooks/useGoogleOAuthPopup", () => ({
  useGoogleOAuthPopup: () => ({ openOAuth: vi.fn(), waiting: false, error: null }),
}));
vi.mock("@/src/providers/AuthContext", () => ({
  useAuthContext: () => ({ user: { role } }),
}));

beforeEach(() => {
  role = "ADMIN";
  connectionState = { loading: false, error: null };
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
    connectionState.data = { connected: true, connectedAt: "2026-09-13T10:00:00.000Z" };
    render(<GoogleIntegrationTab />);
    expect(screen.getByText("Cuenta de Google conectada")).toBeInTheDocument();
    expect(screen.getByTestId("google-reconnect-button")).toBeInTheDocument();
    expect(screen.getByTestId("google-disconnect-button")).toBeInTheDocument();
  });
});
