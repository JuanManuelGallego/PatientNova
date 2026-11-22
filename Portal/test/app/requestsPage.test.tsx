import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RequestsPage from "@/src/app/(provider)/(protected)/requests/page";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { fmtDateTime } from "@/src/utils/TimeUtils";

const TZ = "America/Bogota";
let requestsState: unknown[] = [];

vi.mock("@/src/api/booking-requests/useFetchBookingRequests", () => ({
  useFetchBookingRequests: () => ({
    requests: requestsState, total: requestsState.length, totalPages: 1, loading: false, error: null, fetchRequests: vi.fn(),
  }),
}));
vi.mock("@/src/providers/PendingRequestsContext", () => ({ usePendingRequests: () => ({ enabled: true, refetch: vi.fn() }) }));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => TZ }));
vi.mock("@/src/components/PageLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/src/components/Drawers/RequestDrawer", () => ({
  RequestDrawer: ({ requestId }: { requestId: string }) => <div data-testid="request-drawer">{requestId}</div>,
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("nuqs", async () => {
  const actual = await vi.importActual<typeof import("nuqs")>("nuqs");
  return { ...actual, useQueryState: (_k: string, parser: { defaultValue?: unknown }) => [parser?.defaultValue ?? null, vi.fn()] };
});
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

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

const req = (over: Record<string, unknown> = {}) => ({
  id: "r1", kind: "NEW", status: "PENDING",
  createdAt: "2026-11-20T15:00:00.000Z", startAt: "2026-11-27T14:00:00.000Z", endAt: "2026-11-27T15:00:00.000Z",
  holdExpiresAt: "2099-01-01T00:00:00.000Z", resolvedAt: null,
  name: "Ana", lastName: "Beltrán", contactChannel: "EMAIL", email: "ana@example.com", verifiedPhone: null,
  patientTimezone: TZ, appointmentId: null, patientId: null,
  type: { id: "t1", name: "Consulta inicial" }, location: { id: "l1", name: "Consultorio", isVirtual: false },
  ...over,
});

const renderPage = () => render(<FocusTrapProvider><RequestsPage /></FocusTrapProvider>);

describe("requests page on a narrow screen", () => {
  beforeEach(() => stubContainerWidth(400));
  afterEach(() => {
    vi.unstubAllGlobals();
    requestsState = [];
  });

  it("shows each request as a card that opens the drawer", () => {
    requestsState = [req(), req({ id: "r2", kind: "REVIEW" })];
    renderPage();

    expect(screen.queryByTestId("request-row-r1")).toBeNull();
    const card = screen.getByTestId("request-card-r1");
    expect(card).toHaveTextContent("Ana Beltrán");
    expect(card).toHaveTextContent(fmtDateTime("2026-11-27T14:00:00.000Z", TZ));
    expect(card).toHaveTextContent("Consulta inicial");
    expect(card).toHaveTextContent(fmtDateTime("2026-11-20T15:00:00.000Z", TZ));
    expect(card).not.toHaveTextContent("inactivo");
    expect(screen.getByTestId("request-card-r2")).toHaveTextContent("Paciente inactivo o eliminado");
    expect(within(card).queryByRole("button")).toBeNull();

    fireEvent.click(card);
    expect(screen.getByTestId("request-drawer")).toHaveTextContent("r1");
  });
});
