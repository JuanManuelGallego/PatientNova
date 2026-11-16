import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type ColumnDef } from "@/src/components/DataTable";

function table(columns: ColumnDef[], orderBy?: string) {
  return render(
    <DataTable
      columns={columns}
      rows={[]}
      loading={false}
      renderRow={() => null}
      testId="t"
      orderBy={orderBy}
      order="asc"
      onSort={() => {}}
    />,
  ).getByTestId("t");
}

const noop = () => {};

describe("DataTable secondary columns", () => {
  it("does not force a secondary column visible by default", () => {
    const t = table([
      { label: "A" },
      { label: "B", priority: "secondary", filter: { kind: "single-enum", options: [], value: "", onChange: noop } },
    ]);
    expect(t.getAttribute("data-forced-cols")).toBeNull();
  });

  it("keeps a secondary column visible while its filter is active", () => {
    const t = table([
      { label: "A" },
      { label: "B", priority: "secondary", filter: { kind: "single-enum", options: [], value: "x", onChange: noop } },
    ]);
    expect(t.getAttribute("data-forced-cols")).toBe("2");
  });

  it("keeps the sorted secondary column visible", () => {
    const t = table([{ label: "A" }, { label: "B", sortKey: "b", priority: "secondary" }], "b");
    expect(t.getAttribute("data-forced-cols")).toBe("2");
  });
});

describe("DataTable compact controls", () => {
  it("offers the filter and sort of secondary columns outside their headers", () => {
    const onSort = vi.fn();
    render(
      <DataTable
        columns={[
          { label: "A" },
          {
            label: "Tipo",
            priority: "secondary",
            filter: { kind: "single-enum", options: [{ value: "x", label: "X" }], value: "", onChange: noop, triggerTestId: "type-trigger" },
          },
          { label: "Registrado", sortKey: "createdAt", priority: "secondary" },
          { label: "Estado", filter: { kind: "single-enum", options: [], value: "", onChange: noop, triggerTestId: "status-trigger" } },
        ]}
        rows={[]}
        loading={false}
        renderRow={() => null}
        orderBy="name"
        order="asc"
        onSort={onSort}
      />,
    );
    const bar = screen.getByRole("group", { name: "Filtros y orden de columnas ocultas" });
    expect(bar).toContainElement(screen.getByTestId("type-trigger-compact"));
    expect(screen.queryByTestId("status-trigger-compact")).toBeNull();

    fireEvent.click(screen.getByTestId("type-trigger-compact"));
    expect(screen.getByRole("dialog", { name: "Filtro" })).toBeInTheDocument();
    expect(screen.getByTestId("type-trigger-compact")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("type-trigger")).toHaveAttribute("aria-expanded", "false");

    const [compactSort] = screen.getAllByRole("button", { name: "Ordenar por Registrado" });
    expect(bar).toContainElement(compactSort);
    fireEvent.click(compactSort);
    expect(onSort).toHaveBeenCalledWith("createdAt");
  });

  it("renders no compact bar when no secondary column has a control", () => {
    render(
      <DataTable
        columns={[{ label: "A" }, { label: "B", priority: "secondary" }]}
        rows={[]}
        loading={false}
        renderRow={() => null}
      />,
    );
    expect(screen.queryByRole("group", { name: "Filtros y orden de columnas ocultas" })).toBeNull();
  });
});
