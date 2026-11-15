import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PatientsPage from "@/src/app/(provider)/(protected)/patients/page";

let statsState: unknown = undefined;

vi.mock("@/src/api/patients/useFetchPatients", () => ({
  useFetchPatients: () => ({ patients: [], loading: false, error: null, fetchPatients: vi.fn(), total: 0, totalPages: 1 }),
}));
vi.mock("@/src/api/patients/useFetchPatientsStats", () => ({
  useFetchPatientsStats: () => ({ stats: statsState, fetchStats: vi.fn() }),
}));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/hooks/useDrawerNavigation", () => ({
  useDrawerNavigation: () => ({ target: null, close: vi.fn(), openAppointment: vi.fn(), openPatient: vi.fn(), openReminder: vi.fn() }),
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
