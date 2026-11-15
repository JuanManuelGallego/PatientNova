import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuditLogsView } from "@/src/components/AuditLogs/AuditLogsView";

vi.mock("@/src/api/audit-logs/useFetchAuditLogs", () => ({
  useFetchAuditLogs: () => ({ auditLogs: [], loading: false, error: null, fetchAuditLogs: vi.fn(), totalPages: 1, total: 0 }),
}));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/hooks/useListQueryState", () => ({
  useListQueryState: () => ({
    page: 1, setPage: vi.fn(), debouncedSearch: "", orderBy: "eventTimeUtc", order: "desc", handleSort: vi.fn(),
    searchProps: { search: "", onSearchChange: vi.fn(), searchValue: "", setSearchValue: vi.fn() },
  }),
}));
vi.mock("@/src/hooks/useDateRangeFilter", () => ({ useDateRangeFilter: () => ({ range: null, setRange: vi.fn() }) }));
vi.mock("nuqs", async () => {
  const actual = await vi.importActual<typeof import("nuqs")>("nuqs");
  return { ...actual, useQueryState: (_k: string, parser: { defaultValue?: unknown }) => [parser?.defaultValue ?? null, vi.fn()] };
});

describe("AuditLogsView copy", () => {
  it("accents the column headers and the search placeholder", () => {
    render(<AuditLogsView />);
    expect(screen.getByText("Acción")).toBeInTheDocument();
    expect(screen.getByText("Descripción")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar por actor, descripción o entidad…")).toBeInTheDocument();
  });

  it("puts the refresh button in the page header", () => {
    render(<AuditLogsView />);
    expect(screen.getByTestId("audit-refresh-button").closest(".page-header__actions")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Actividad" })).toBeInTheDocument();
  });
});
