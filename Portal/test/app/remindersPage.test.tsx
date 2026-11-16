import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RemindersPage from "@/src/app/(provider)/(protected)/reminders/page";

let fetchState: { reminders: unknown[]; error: string | null; loading: boolean } = {
  reminders: [], error: null, loading: false,
};
let statsState: unknown = undefined;

vi.mock("@/src/api/reminders/useFetchReminders", () => ({
  useFetchReminders: () => ({ ...fetchState, fetchReminders: vi.fn(), total: 0, totalPages: 1 }),
}));
vi.mock("@/src/api/reminders/useFetchRemindersStats", () => ({
  useFetchRemindersStats: () => ({ stats: statsState, fetchStats: vi.fn() }),
}));
vi.mock("@/src/api/reminders/useRetryReminder", () => ({ useRetryReminder: () => ({ retryReminder: vi.fn(), loading: false }) }));
vi.mock("@/src/api/patients/useFetchAllPatients", () => ({ useFetchAllPatients: () => ({ patients: [], loading: false }) }));
vi.mock("@/src/api/patients/useFetchPatient", () => ({ useFetchPatient: () => ({ patient: null }) }));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/hooks/useDrawerNavigation", () => ({
  useDrawerNavigation: () => ({ target: null, close: vi.fn(), openAppointment: vi.fn(), openPatient: vi.fn(), openReminder: vi.fn() }),
}));
vi.mock("@/src/components/PageLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/src/components/Modals/ReminderModal", () => ({ ReminderModal: () => null }));
vi.mock("@/src/components/Modals/EditScheduledReminderModal", () => ({ EditScheduledReminderModal: () => null }));
vi.mock("@/src/components/Modals/CancelReminderModal", () => ({ CancelReminderModal: () => null }));
vi.mock("@/src/components/Drawers/RelatedDrawers", () => ({ RelatedDrawers: () => null }));
vi.mock("@/src/components/Reminders/BulkSendWizard", () => ({ BulkSendWizard: () => null }));
vi.mock("nuqs", async () => {
  const actual = await vi.importActual<typeof import("nuqs")>("nuqs");
  return { ...actual, useQueryState: (_k: string, parser: { defaultValue?: unknown }) => [parser?.defaultValue ?? null, vi.fn()] };
});

describe("reminders page", () => {
  it("shows the error banner and no empty state or zero stats when the fetch fails", () => {
    fetchState = { reminders: [], error: "No pudimos conectar con el servidor", loading: false };
    statsState = undefined;
    render(<RemindersPage />);
    expect(screen.getByText(/No pudimos conectar con el servidor/)).toBeInTheDocument();
    expect(screen.queryByText("Sin recordatorios activos")).toBeNull();
    expect(screen.getByTestId("stat-card-activos")).toHaveTextContent("—");
  });

  it("shows the empty state when the fetch succeeds with no rows", () => {
    fetchState = { reminders: [], error: null, loading: false };
    statsState = { byStatus: {}, total: 0 };
    render(<RemindersPage />);
    expect(screen.getByText("Sin recordatorios activos")).toBeInTheDocument();
  });
});
