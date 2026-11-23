import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationAndTimeStep } from "@/src/components/Modals/AppointmentModal/LocationAndTimeStep";
import { AppointmentDuration, AppointmentForm, AppointmentPaidStatus, AppointmentStatus } from "@/src/types/Appointment";
import { ReminderType } from "@/src/types/Reminder";
import { ApiMutationError } from "@/src/api/base/useApiMutation";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

const createMeet = vi.fn();
const startOAuth = vi.fn();
let connected = true;
let status: "connected" | "expired" | "not_connected" = "connected";

vi.mock("@/src/api/google/useCreateGoogleMeet", () => ({
  useCreateGoogleMeet: () => ({ createMeet, loading: false, error: null }),
}));
vi.mock("@/src/api/google/useStartGoogleOAuth", () => ({
  useStartGoogleOAuth: () => ({ startOAuth, loading: false, error: null }),
}));
vi.mock("@/src/api/google/useFetchGoogleConnection", () => ({
  useFetchGoogleConnection: () => ({ data: { connected, status }, loading: false, error: null }),
}));
vi.mock("@/src/providers/AuthContext", () => ({
  useAuthContext: () => ({ user: { role: "ADMIN" } }),
}));
vi.mock("@/src/components/CustomSelect", () => ({
  CustomSelect: () => <div />,
}));

const initialForm: AppointmentForm = {
  startAt: "2026-09-14T10:00:00.000Z",
  duration: AppointmentDuration.MIN_60,
  price: 100,
  paid: AppointmentPaidStatus.UNPAID,
  locationId: "virtual",
  typeId: "type",
  status: AppointmentStatus.SCHEDULED,
  patientId: "patient",
  reminderType: ReminderType.NONE,
};

function Harness({ meetingUrl }: { meetingUrl?: string }) {
  const [ form, setForm ] = useState<AppointmentForm>({ ...initialForm, meetingUrl });
  return (
    <FocusTrapProvider>
      <LocationAndTimeStep
        form={form}
        set={(field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
        setForm={setForm}
        selectedPatient={undefined}
        reminderChannel={undefined}
        locations={[ { id: "virtual", name: "Virtual", isVirtual: true } ]}
      />
      <output data-testid="meeting-url">{form.meetingUrl}</output>
    </FocusTrapProvider>
  );
}

beforeEach(() => {
  connected = true;
  status = "connected";
  createMeet.mockReset().mockResolvedValue({ meetingUrl: "https://meet.google.com/new", spaceName: "space" });
  startOAuth.mockReset().mockResolvedValue({ authUrl: "https://accounts.google.test" });
  vi.restoreAllMocks();
});

describe("LocationAndTimeStep Google Meet", () => {
  it("generates immediately when connected", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByTestId("generate-meet-link-button"));

    await waitFor(() => expect(screen.getByTestId("meeting-url")).toHaveTextContent("https://meet.google.com/new"));
    expect(createMeet).toHaveBeenCalledTimes(1);
    expect(startOAuth).not.toHaveBeenCalled();
  });

  it("generates exactly once after disconnected OAuth completes", async () => {
    connected = false;
    const popup = { closed: false, close: vi.fn(), location: { href: "" } } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    render(<Harness />);
    await userEvent.click(screen.getByTestId("generate-meet-link-button"));

    const event = new MessageEvent("message", {
      origin: window.location.origin,
      source: popup,
      data: { type: "GOOGLE_OAUTH_COMPLETE", success: true },
    });
    await act(async () => {
      window.dispatchEvent(event);
      window.dispatchEvent(event);
    });

    await waitFor(() => expect(createMeet).toHaveBeenCalledTimes(1));
    expect(startOAuth).toHaveBeenCalledTimes(1);
  });

  it("shows an expired connection up front and reconnects with consent", async () => {
    connected = false;
    status = "expired";
    const popup = { closed: false, close: vi.fn(), location: { href: "" } } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    render(<Harness />);

    expect(screen.getByRole("button", { name: /Reconectar y generar/ })).toBeInTheDocument();
    expect(screen.getByTestId("google-expired-hint")).toHaveTextContent("pega el enlace de tu propia sala");
    expect(screen.getByTestId("generate-meet-link-button")).toHaveAccessibleDescription(/Tu conexión con Google expiró/);
    expect(screen.getByTestId("appointment-meeting-url-input")).toBeEnabled();

    await userEvent.click(screen.getByTestId("generate-meet-link-button"));
    expect(startOAuth).toHaveBeenCalledWith("/appointments", true);
    expect(createMeet).not.toHaveBeenCalled();
  });

  it("asks to reconnect before regenerating an existing URL when expired", async () => {
    connected = false;
    status = "expired";
    render(<Harness meetingUrl="https://zoom.us/j/123" />);
    expect(screen.getByRole("button", { name: /Reconectar y generar/ })).toBeInTheDocument();
  });

  it("asks in an in-app dialog before replacing an existing URL, and keeps it on Regresar", async () => {
    const confirm = vi.spyOn(window, "confirm");
    render(<Harness meetingUrl="https://zoom.us/j/123" />);

    expect(screen.getByRole("button", { name: /Regenerar Google Meet/ })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("generate-meet-link-button"));
    expect(screen.getByRole("alertdialog", { name: /Reemplazar el enlace/ })).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(createMeet).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId("replace-meet-link-dialog-cancel-button"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(createMeet).not.toHaveBeenCalled();
    expect(screen.getByTestId("meeting-url")).toHaveTextContent("https://zoom.us/j/123");
  });

  it("replaces the existing URL once the dialog is confirmed", async () => {
    render(<Harness meetingUrl="https://zoom.us/j/123" />);
    await userEvent.click(screen.getByTestId("generate-meet-link-button"));
    await userEvent.click(screen.getByTestId("replace-meet-link-dialog-confirm-button"));

    await waitFor(() => expect(screen.getByTestId("meeting-url")).toHaveTextContent("https://meet.google.com/new"));
    expect(createMeet).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("closes the dialog with Escape without replacing the URL", async () => {
    render(<Harness meetingUrl="https://zoom.us/j/123" />);
    await userEvent.click(screen.getByTestId("generate-meet-link-button"));
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(createMeet).not.toHaveBeenCalled();
  });

  it("turns a 409 into an explicit reconnect request", async () => {
    createMeet.mockRejectedValueOnce(new ApiMutationError("Reconnect", 409));
    const popup = { closed: false, close: vi.fn(), location: { href: "" } } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    render(<Harness />);

    await userEvent.click(screen.getByTestId("generate-meet-link-button"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/debe renovarse/);
    expect(screen.getByRole("button", { name: /Reconectar y generar/ })).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("generate-meet-link-button"));
    expect(startOAuth).toHaveBeenCalledWith("/appointments", true);
  });

  it("allows an empty URL but reports malformed manual URLs", async () => {
    render(<Harness />);
    const input = screen.getByTestId("appointment-meeting-url-input");
    expect(input).not.toBeRequired();

    await userEvent.type(input, "not-a-url");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/URL completa/);
  });

  it("links to Integraciones instead of starting OAuth from the modal when installed", async () => {
    connected = false;
    status = "not_connected";
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    try {
      render(<Harness />);
      const link = await screen.findByRole("link", { name: "conecta Google en Configuración" });
      expect(link).toHaveAttribute("href", "/settings/integrations");
      expect(screen.getByTestId("generate-meet-link-button")).toBeDisabled();
      expect(screen.queryByTestId("google-expired-hint")).toBeNull();
      await userEvent.click(screen.getByTestId("generate-meet-link-button"));
      expect(startOAuth).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(window, "matchMedia");
    }
  });
});
