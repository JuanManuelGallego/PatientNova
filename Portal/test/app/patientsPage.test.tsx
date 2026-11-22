import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PatientsPage from "@/src/app/(provider)/(protected)/patients/page";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

let statsState: unknown = undefined;
let patientsState: unknown[] = [];
const openPatient = vi.fn();

vi.mock("@/src/api/patients/useFetchPatients", () => ({
  useFetchPatients: () => ({
    patients: patientsState, loading: false, error: null, fetchPatients: vi.fn(),
    total: patientsState.length, totalPages: 1,
  }),
}));
vi.mock("@/src/api/patients/useFetchPatientsStats", () => ({
  useFetchPatientsStats: () => ({ stats: statsState, fetchStats: vi.fn() }),
}));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/hooks/useDrawerNavigation", () => ({
  useDrawerNavigation: () => ({ target: null, close: vi.fn(), openAppointment: vi.fn(), openPatient, openReminder: vi.fn() }),
}));
vi.mock("@/src/components/PageLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/src/components/Modals/PatientModal", () => ({ PatientModal: () => null }));
vi.mock("@/src/components/Modals/TogglePatientModal", () => ({ TogglePatientModal: () => null }));
vi.mock("@/src/components/Drawers/RelatedDrawers", () => ({ RelatedDrawers: () => null }));
vi.mock("nuqs", async () => {
  const actual = await vi.importActual<typeof import("nuqs")>("nuqs");
  return { ...actual, useQueryState: (_k: string, parser: { defaultValue?: unknown }) => [parser?.defaultValue ?? null, vi.fn()] };
});

describe("patients page stats", () => {
  it("shows 0, not a dash, for a status absent from loaded stats", () => {
    statsState = { total: 3, byStatus: { ACTIVE: 3 } };
    render(<PatientsPage />);
    expect(screen.getByTestId("stat-card-activos")).toHaveTextContent("3");
    const inactive = screen.getByTestId("stat-card-inactivos");
    expect(inactive).toHaveTextContent("0");
    expect(inactive).not.toHaveTextContent("—");
  });

  it("shows a dash while stats are missing", () => {
    statsState = undefined;
    render(<PatientsPage />);
    expect(screen.getByTestId("stat-card-inactivos")).toHaveTextContent("—");
  });
});

/** Every observed element reports `width` px, as a ResizeObserver would after layout. */
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

const patient = (over: Record<string, unknown>) => ({
  id: "p1", name: "María José", lastName: "Hernández Villalobos", email: "maria@example.com",
  whatsappNumber: "+573001112233", smsNumber: null, status: "ACTIVE", createdAt: "2026-01-02T15:00:00Z",
  ...over,
});

describe("patients page on a narrow screen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    patientsState = [];
  });

  it("lists patients as cards with initials, full name and one contact line", () => {
    stubContainerWidth(400);
    patientsState = [patient({}), patient({ id: "p2", name: "Luis", lastName: "Paz", email: null })];
    render(<FocusTrapProvider><PatientsPage /></FocusTrapProvider>);

    expect(screen.queryByTestId("patient-row-p1")).toBeNull();
    const card = screen.getByTestId("patient-card-p1");
    expect(card).toHaveTextContent("MH");
    expect(card).toHaveTextContent("María José Hernández Villalobos");
    expect(card).toHaveTextContent("maria@example.com");
    expect(card).not.toHaveTextContent("+573001112233");
    // Without an email the card shows the WhatsApp number instead.
    expect(screen.getByTestId("patient-card-p2")).toHaveTextContent("+573001112233");
    // Actions live in the drawer, not on the card.
    expect(within(card).queryByRole("button", { name: /Editar|Desactivar/ })).toBeNull();

    fireEvent.click(card);
    expect(openPatient).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
  });
});
