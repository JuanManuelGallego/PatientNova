import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RemindersPage from "@/src/app/(provider)/(protected)/reminders/page";

let fetchState: { reminders: unknown[]; error: string | null; loading: boolean } = {
  reminders: [], error: null, loading: false,
};
let statsState: unknown = undefined;
let tabState = "Active";
const openReminder = vi.fn();

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
  useDrawerNavigation: () => ({ target: null, close: vi.fn(), openAppointment: vi.fn(), openPatient: vi.fn(), openReminder }),
}));
vi.mock("@/src/components/PageLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/src/components/Modals/ReminderModal", () => ({ ReminderModal: () => null }));
vi.mock("@/src/components/Modals/EditScheduledReminderModal", () => ({ EditScheduledReminderModal: () => null }));
vi.mock("@/src/components/Modals/CancelReminderModal", () => ({ CancelReminderModal: () => null }));
vi.mock("@/src/components/Drawers/RelatedDrawers", () => ({ RelatedDrawers: () => null }));
vi.mock("@/src/components/Reminders/BulkSendWizard", () => ({ BulkSendWizard: () => null }));
vi.mock("nuqs", async () => {
  const actual = await vi.importActual<typeof import("nuqs")>("nuqs");
  return { ...actual, useQueryState: (_k: string, parser: { defaultValue?: unknown }) => [_k === "reminderTab" || _k === "activeTab" ? tabState : parser?.defaultValue ?? null, vi.fn()] };
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

  it("Activos: Creado el is a secondary column showing when the reminder was created, not its send time", () => {
    fetchState = {
      reminders: [ {
        id: "r9", status: "PENDING", channel: "WHATSAPP", to: "+573001112233",
        sendAt: "2026-12-01T15:00:00.000Z", createdAt: "2026-11-20T15:00:00.000Z", updatedAt: "2026-11-20T15:00:00.000Z",
        error: null, messageId: null, retryCount: 0, patient: { id: "p1", name: "Ana", lastName: "Beltrán" },
      } ],
      error: null, loading: false,
    };
    statsState = { byStatus: {}, total: 0 };
    render(<RemindersPage />);
    const header = screen.getByRole("columnheader", { name: "Creado el" });
    expect(header).toHaveClass("col--secondary");
    const row = screen.getByText("Ana Beltrán").closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    const createdCell = cells[[ ...header.parentElement!.children ].indexOf(header)];
    expect(createdCell).toHaveClass("col--secondary");
    expect(createdCell).toHaveTextContent(/20 nov 2026/);
    expect(createdCell).not.toHaveTextContent(/1 dic 2026/);
  });

  it("shows the empty state when the fetch succeeds with no rows", () => {
    fetchState = { reminders: [], error: null, loading: false };
    statsState = { byStatus: {}, total: 0 };
    render(<RemindersPage />);
    expect(screen.getByText("Sin recordatorios activos")).toBeInTheDocument();
  });
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

const reminder = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  status: "PENDING",
  channel: "WHATSAPP",
  to: "+573001112233",
  sendAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  updatedAt: "2026-11-20T10:00:00.000Z",
  error: null,
  messageId: null,
  retryCount: 0,
  patient: { id: "p1", name: "Ana", lastName: "Beltrán" },
  ...over,
});

describe("reminders page on a narrow screen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    tabState = "Active";
    openReminder.mockClear();
  });

  it("Activos shows cards with recipient, when, relative time, channel and status, and a tap opens the drawer", () => {
    stubContainerWidth(400);
    fetchState = { reminders: [reminder()], error: null, loading: false };
    statsState = { byStatus: {}, total: 0 };
    render(<RemindersPage />);
    expect(screen.queryByTestId("reminder-row-r1")).toBeNull();
    const card = screen.getByTestId("reminder-card-r1");
    expect(card).toHaveTextContent("Ana Beltrán");
    expect(card).toHaveTextContent("Dentro de 3 días");
    expect(card).toHaveTextContent("WhatsApp");
    expect(card).toHaveTextContent("Pendiente");
    expect(within(card).queryByRole("button")).toBeNull();
    fireEvent.click(card);
    expect(openReminder).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" }));
  });

  it("an overdue reminder reads as past, not \"Dentro de\"", () => {
    stubContainerWidth(400);
    fetchState = { reminders: [reminder({ status: "QUEUED", sendAt: new Date(Date.now() - 5 * 60_000).toISOString() })], error: null, loading: false };
    statsState = { byStatus: {}, total: 0 };
    render(<RemindersPage />);
    const card = screen.getByTestId("reminder-card-r1");
    expect(card).toHaveTextContent("Hace 5 min");
    expect(card).not.toHaveTextContent("Dentro de");
  });

  it("Historial shows cards with the error of a failed reminder", () => {
    stubContainerWidth(400);
    tabState = "History";
    fetchState = {
      reminders: [
        reminder({ id: "r2", status: "FAILED", channel: "SMS", error: "Número inválido" }),
        reminder({ id: "r3", status: "SENT" }),
      ],
      error: null,
      loading: false,
    };
    render(<RemindersPage />);
    const failed = screen.getByTestId("reminder-card-r2");
    expect(failed).toHaveTextContent("Ana Beltrán");
    expect(failed).toHaveTextContent("SMS");
    expect(failed).toHaveTextContent("Número inválido");
    expect(screen.getByTestId("reminder-card-r3")).not.toHaveTextContent("Dentro de");
    fireEvent.click(failed);
    expect(openReminder).toHaveBeenCalledWith(expect.objectContaining({ id: "r2" }));
  });
});
