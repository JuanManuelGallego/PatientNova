import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLogsView } from "@/src/components/AuditLogs/AuditLogsView";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { fmtTimestamp } from "@/src/utils/TimeUtils";

const TZ = "America/Bogota";
const log = {
  id: "g1", userId: "u1", actorId: "a1", actorDisplayName: "Dra. Pérez", eventTimeUtc: "2026-11-20T15:00:00.000Z",
  entityType: "APPOINTMENT", entityId: "e1", actionType: "CREATE", source: "WEB",
  description: "Creó una cita", affectedFields: [], fieldsBefore: null, fieldsAfter: null, ipAddress: null,
};

vi.mock("@/src/api/audit-logs/useFetchAuditLogs", () => ({
  useFetchAuditLogs: () => ({ auditLogs: [log], loading: false, error: null, fetchAuditLogs: vi.fn(), totalPages: 1, total: 1 }),
}));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => TZ }));
vi.mock("@/src/hooks/useListQueryState", () => ({
  useListQueryState: () => ({
    page: 1, setPage: vi.fn(), debouncedSearch: "", orderBy: "eventTimeUtc", order: "desc", handleSort: vi.fn(),
    searchProps: { search: "", onSearchChange: vi.fn(), searchValue: "", setSearchValue: vi.fn() },
  }),
}));
vi.mock("@/src/hooks/useDateRangeFilter", () => ({ useDateRangeFilter: () => ({ range: null, setRange: vi.fn() }) }));
vi.mock("@/src/components/Drawers/AuditDrawer", () => ({
  AuditDrawer: ({ log: l }: { log: { id: string } }) => <div data-testid="audit-drawer">{l.id}</div>,
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

describe("AuditLogsView on a narrow screen", () => {
  beforeEach(() => stubContainerWidth(400));
  afterEach(() => vi.unstubAllGlobals());

  it("shows each entry as a card with labels, actor, time and summary", () => {
    render(<FocusTrapProvider><AuditLogsView /></FocusTrapProvider>);
    expect(screen.queryByTestId("audit-row-g1")).toBeNull();
    const card = screen.getByTestId("audit-card-g1");
    expect(card).toHaveTextContent("Dra. Pérez");
    expect(card).toHaveTextContent(fmtTimestamp(log.eventTimeUtc, TZ));
    expect(card).toHaveTextContent("Creó una cita");
    fireEvent.click(card);
    expect(screen.getByTestId("audit-drawer")).toHaveTextContent("g1");
  });
});
