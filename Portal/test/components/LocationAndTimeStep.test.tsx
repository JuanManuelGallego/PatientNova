import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationAndTimeStep } from "@/src/components/Modals/AppointmentModal/LocationAndTimeStep";
import { AppointmentDuration, AppointmentForm, AppointmentPaidStatus, AppointmentStatus } from "@/src/types/Appointment";
import { ReminderType } from "@/src/types/Reminder";
import { ApiMutationError } from "@/src/api/base/useApiMutation";

const createMeet = vi.fn();
const startOAuth = vi.fn();
let connected = true;

vi.mock("@/src/api/google/useCreateGoogleMeet", () => ({
  useCreateGoogleMeet: () => ({ createMeet, loading: false, error: null }),
}));
vi.mock("@/src/api/google/useStartGoogleOAuth", () => ({
  useStartGoogleOAuth: () => ({ startOAuth, loading: false, error: null }),
}));
vi.mock("@/src/api/google/useFetchGoogleConnection", () => ({
  useFetchGoogleConnection: () => ({ data: { connected }, loading: false, error: null }),
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
    <>
      <LocationAndTimeStep
        form={form}
        set={(field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
        setForm={setForm}
        selectedPatient={undefined}
        reminderChannel={undefined}
        locations={[ { id: "virtual", name: "Virtual", isVirtual: true } ]}
      />
      <output data-testid="meeting-url">{form.meetingUrl}</output>
    </>
  );
}

beforeEach(() => {
  connected = true;
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

  it("requires confirmation before replacing an existing URL", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Harness meetingUrl="https://zoom.us/j/123" />);

    expect(screen.getByRole("button", { name: /Regenerar Google Meet/ })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("generate-meet-link-button"));
    expect(confirm).toHaveBeenCalledOnce();
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
});
