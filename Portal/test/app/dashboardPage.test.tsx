import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/src/app/(provider)/(protected)/dashboard/page";

vi.mock("@/src/api/appointments/useFetchAppointmentsStats", () => ({ useFetchAppointmentsStats: () => ({ stats: undefined, loading: false }) }));
vi.mock("@/src/api/appointments/useFetchAppointments", () => ({ useFetchAppointments: () => ({ appointments: [], loading: false }) }));
vi.mock("@/src/api/reminders/useFetchRemindersStats", () => ({ useFetchRemindersStats: () => ({ stats: undefined, loading: false }) }));
vi.mock("@/src/api/patients/useFetchPatientsStats", () => ({ useFetchPatientsStats: () => ({ stats: undefined, loading: false }) }));
vi.mock("@/src/providers/AuthContext", () => ({ useAuthContext: () => ({ user: { displayName: "Ana" } }) }));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/components/PageLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/src/components/Modals/AppointmentModal", () => ({ AppointmentModal: () => null }));
vi.mock("@/src/components/Modals/PatientModal", () => ({ PatientModal: () => null }));
vi.mock("@/src/components/Dashboard/PendingRequestsCard", () => ({ PendingRequestsCard: () => null }));

describe("dashboard page", () => {
  it("shows a dash, never a zero, when stats are missing", () => {
    render(<DashboardPage />);
    expect(screen.getByText("— citas programadas")).toBeInTheDocument();
    expect(screen.getByText("— registrados")).toBeInTheDocument();
    expect(screen.getByText("— programados este mes")).toBeInTheDocument();
    expect(screen.getByText("— en total")).toBeInTheDocument();
  });
});
