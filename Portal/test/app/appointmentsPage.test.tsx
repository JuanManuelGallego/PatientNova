import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppointmentsPage from "@/src/app/(provider)/(protected)/appointments/page";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import { PHONE_MEDIA_QUERY } from "@/src/hooks/usePhoneLayout";

const TZ = "America/Bogota";
let appointmentsState: unknown[] = [];
const openAppointment = vi.fn();

vi.mock("@/src/api/appointments/useFetchAppointments", () => ({
  useFetchAppointments: () => ({
    appointments: appointmentsState, loading: false, error: null, fetchAppointments: vi.fn(),
    total: appointmentsState.length, totalPages: 1,
  }),
}));
vi.mock("@/src/api/appointments/useFetchAppointmentsStats", () => ({
  useFetchAppointmentsStats: () => ({ stats: undefined, fetchStats: vi.fn() }),
}));
vi.mock("@/src/api/appointments/useUpdateAppointment", () => ({ useUpdateAppointment: () => ({ updateAppointment: vi.fn() }) }));
vi.mock("@/src/api/appointment-types/useFetchAppointmentTypes", () => ({ useFetchAppointmentTypes: () => ({ appointmentTypes: [] }) }));
vi.mock("@/src/api/locations/useFetchLocations", () => ({ useFetchLocations: () => ({ locations: [] }) }));
vi.mock("@/src/api/patients/useFetchPatient", () => ({ useFetchPatient: () => ({ patient: null }) }));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => TZ }));
vi.mock("@/src/hooks/useDrawerNavigation", () => ({
  useDrawerNavigation: () => ({ target: null, close: vi.fn(), openAppointment, openPatient: vi.fn(), openReminder: vi.fn() }),
}));
vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
vi.mock("@/src/components/PageLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/src/components/Modals/AppointmentModal", () => ({ AppointmentModal: () => <div data-testid="appointment-modal-mock" /> }));
vi.mock("@/src/components/Modals/CancelAppointmentModal", () => ({ CancelAppointmentModal: () => null }));
vi.mock("@/src/components/Drawers/RelatedDrawers", () => ({ RelatedDrawers: () => null }));
vi.mock("nuqs", async () => {
  const actual = await vi.importActual<typeof import("nuqs")>("nuqs");
  return { ...actual, useQueryState: (_k: string, parser: { defaultValue?: unknown }) => [parser?.defaultValue ?? null, vi.fn()] };
});

function stubContainerWidth(width: number) {
  class FakeResizeObserver {
    constructor(private readonly cb: ResizeObserverCallback) {}
    observe(target: Element) {
      this.cb([{ target, contentRect: { width } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
}

const appointment = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  startAt: "2026-11-27T14:00:00.000Z",
  endAt: "2026-11-27T15:00:00.000Z",
  status: "SCHEDULED",
  paid: false,
  patient: { id: "p1", name: "Ana", lastName: "Beltrán", email: "ana@example.com" },
  appointmentType: { id: "t1", name: "Consulta inicial", color: "#7c3aed" },
  appointmentLocation: { id: "l1", name: "Consultorio", color: null },
  reminder: null,
  meetingUrl: null,
  ...over,
});

const renderPage = () => render(<FocusTrapProvider><AppointmentsPage /></FocusTrapProvider>);

describe("appointments page on a narrow screen", () => {
  beforeEach(() => {
    stubContainerWidth(400);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    appointmentsState = [];
  });

  it("shows each appointment as a card with patient, time in the provider zone, type, status and payment", () => {
    appointmentsState = [appointment(), appointment({ id: "a2", status: "CANCELLED" })];
    renderPage();

    expect(screen.queryByTestId("appointment-row-a1")).toBeNull();
    const card = screen.getByTestId("appointment-card-a1");
    expect(card).toHaveTextContent("Ana Beltrán");
    expect(card).toHaveTextContent(fmtDateTime("2026-11-27T14:00:00.000Z", TZ));
    expect(card).toHaveTextContent("9:00");
    expect(card).toHaveTextContent("Consulta inicial");
    expect(card).toHaveTextContent("Programada");
    expect(card).toHaveTextContent("Sin pagar");
    expect(screen.getByTestId("appointment-card-a2")).not.toHaveTextContent(/Sin pagar|Pagado/);
    expect(within(card).queryByRole("button")).toBeNull();

    fireEvent.click(card);
    expect(openAppointment).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
  });

  it("gathers every column filter and the sort into the Filtros sheet", () => {
    appointmentsState = [appointment()];
    renderPage();
    expect(screen.queryByTestId("appointment-status-filter-trigger")).toBeNull();

    fireEvent.click(screen.getByTestId("appointments-table-filters-button"));
    const sheet = screen.getByTestId("appointments-table-filters-sheet");
    for (const label of ["Tipo", "Fecha y hora", "Ubicación", "Estado", "Pago"]) {
      expect(within(sheet).getByRole("heading", { name: label })).toBeInTheDocument();
    }
    expect(within(sheet).getByRole("radio", { name: "Fecha y hora" })).toBeChecked();
    expect(within(sheet).getByTestId("appointment-status-filter")).toBeInTheDocument();
  });
});

describe("appointments page Nueva cita", () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    appointmentsState = [];
  });

  it("keeps the header button and shows no floating button on a wider screen", () => {
    renderPage();
    expect(screen.getByTestId("appointments-new-button")).toBeInTheDocument();
    expect(screen.queryByTestId("appointments-fab-new-appointment")).toBeNull();
  });

  it("on a phone opens the new-appointment modal from the floating button", () => {
    window.matchMedia = ((query: string) => ({
      matches: query === PHONE_MEDIA_QUERY,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    renderPage();

    const fab = screen.getByTestId("appointments-fab-new-appointment");
    expect(fab).toHaveAccessibleName("Nueva cita");
    expect(screen.queryByTestId("appointment-modal-mock")).toBeNull();
    fireEvent.click(fab);
    expect(screen.getByTestId("appointment-modal-mock")).toBeInTheDocument();
  });
});
