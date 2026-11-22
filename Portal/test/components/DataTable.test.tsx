import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataCard, DataTable, type ColumnDef } from "@/src/components/DataTable";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
// Closing a sheet restores the scroll position, which jsdom does not implement (also after a test's own cleanup).
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

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

/** Makes every observed element report `width` px, as a ResizeObserver would after layout. */
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

type Item = { id: string; name: string };
const ITEMS: Item[] = [{ id: "a", name: "Ana" }, { id: "b", name: "Beto" }];

function cardTable(props: Partial<React.ComponentProps<typeof DataTable<Item>>> = {}, onOpen = vi.fn()) {
  return render(
    <FocusTrapProvider>
      <DataTable<Item>
        columns={[{ label: "Nombre", sortKey: "name" }, { label: "", priority: "actions" }]}
        rows={ITEMS}
        loading={false}
        testId="items-table"
        renderRow={(r) => <tr key={r.id} data-testid={`item-row-${r.id}`}><td>{r.name}</td></tr>}
        renderCard={(r) => <DataCard key={r.id} testId={`item-card-${r.id}`} onOpen={() => onOpen(r)} title={r.name} />}
        orderBy="name"
        order="asc"
        onSort={() => {}}
        {...props}
      />
    </FocusTrapProvider>,
  );
}

describe("DataTable card layout", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the table when the container cannot be measured", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    cardTable();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByTestId("item-row-a")).toBeInTheDocument();
    expect(screen.queryByTestId("item-card-a")).toBeNull();
  });

  it("keeps the table in a wide container", () => {
    stubContainerWidth(900);
    cardTable();
    expect(screen.getByTestId("item-row-a")).toBeInTheDocument();
    expect(screen.queryByTestId("item-card-a")).toBeNull();
  });

  it("keeps the table in a narrow container when the page gives no card", () => {
    stubContainerWidth(400);
    cardTable({ renderCard: undefined });
    expect(screen.getByTestId("item-row-a")).toBeInTheDocument();
  });

  it("renders a list of cards, and no table rows, in a narrow container", () => {
    stubContainerWidth(400);
    cardTable();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByTestId("item-row-a")).toBeNull();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByTestId("item-card-a")).toBeInTheDocument();
  });

  it("opens the item when its card is tapped", () => {
    stubContainerWidth(400);
    const onOpen = vi.fn();
    cardTable({}, onOpen);
    const card = screen.getByTestId("item-card-b");
    expect(card.tagName).toBe("BUTTON");
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith(ITEMS[1]);
  });

  it("shows skeleton cards while loading", () => {
    stubContainerWidth(400);
    cardTable({ loading: true, skeletonCount: 3 });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByTestId("data-card-skeleton")).toHaveLength(3);
    expect(screen.queryByTestId("item-card-a")).toBeNull();
  });

  it("shows the empty state when there are no rows", () => {
    stubContainerWidth(400);
    cardTable({ rows: [], emptyState: <p>Nada por aquí</p> });
    expect(screen.getByText("Nada por aquí")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("keeps the footer under the cards", () => {
    stubContainerWidth(400);
    cardTable({ footer: <span>Mostrando 2 de 2</span> });
    expect(screen.getByText("Mostrando 2 de 2")).toBeInTheDocument();
  });
});

const filterColumns = (onType = vi.fn(), onStatus = vi.fn(), onRange = vi.fn()): ColumnDef[] => [
  { label: "Paciente" },
  {
    label: "Tipo",
    priority: "secondary",
    filter: { kind: "single-enum", options: [{ value: "", label: "Todos" }, { value: "t1", label: "Consulta" }], value: "t1", onChange: onType },
  },
  { label: "Fecha y hora", sortKey: "startAt", filter: { kind: "date-range", value: null, onChange: onRange } },
  {
    label: "Estado",
    sortKey: "status",
    filter: { kind: "enum", options: [{ value: "", label: "Todos" }, { value: "S", label: "Programada" }], value: ["S"], onChange: onStatus },
  },
  { label: "", priority: "actions" },
];

describe("DataTable filter sheet (card layout)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("replaces header and compact filter controls with one Filtros button counting active filters", () => {
    stubContainerWidth(400);
    cardTable({ columns: filterColumns() });
    expect(screen.queryByRole("group", { name: "Filtros y orden de columnas ocultas" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Filtrar por/ })).toBeNull();
    const button = screen.getByTestId("items-table-filters-button");
    expect(button).toHaveAccessibleName("Filtros, 2 activos");
    expect(within(button).getByText("2")).toBeInTheDocument();
  });

  it("does not reopen the sheet by itself after the layout switches to the table and back (rotation)", () => {
    let width = 400;
    const observers: Array<{ cb: ResizeObserverCallback; target: Element }> = [];
    class ResizableObserver {
      constructor(private readonly cb: ResizeObserverCallback) {}
      observe(target: Element) {
        observers.push({ cb: this.cb, target });
        this.cb([{ target, contentRect: { width } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizableObserver);
    const resize = (next: number) => act(() => {
      width = next;
      for (const { cb, target } of observers) cb([{ target, contentRect: { width } } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    });

    cardTable({ columns: filterColumns() });
    fireEvent.click(screen.getByTestId("items-table-filters-button"));
    expect(screen.getByTestId("items-table-filters-sheet")).toBeInTheDocument();

    resize(900);
    expect(screen.queryByTestId("items-table-filters-sheet")).toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();

    resize(400);
    expect(screen.getByTestId("items-table-filters-button")).toBeInTheDocument();
    expect(screen.queryByTestId("items-table-filters-sheet")).toBeNull();
  });

  it("names the button for sorting when no column has a filter", () => {
    stubContainerWidth(400);
    cardTable();
    expect(screen.getByTestId("items-table-filters-button")).toHaveAccessibleName("Ordenar");
  });

  it("opens a sheet with every column filter and the sort choices", () => {
    stubContainerWidth(400);
    const onType = vi.fn();
    cardTable({ columns: filterColumns(onType) });
    fireEvent.click(screen.getByTestId("items-table-filters-button"));
    const sheet = screen.getByRole("dialog", { name: "Filtros y orden" });
    for (const label of ["Tipo", "Fecha y hora", "Estado"]) {
      expect(within(sheet).getByRole("heading", { name: label })).toBeInTheDocument();
    }
    const sort = within(sheet).getByRole("radiogroup", { name: "Ordenar por" });
    expect(within(sort).getAllByRole("radio")).toHaveLength(2);
    expect(within(sort).getByRole("radio", { name: "Fecha y hora" })).toBeInTheDocument();
    expect(within(sort).getByRole("radio", { name: "Estado" })).toBeInTheDocument();

    // Filters apply as they change, like the header popovers.
    const typeSection = within(sheet).getByRole("heading", { name: "Tipo" }).closest("section")!;
    fireEvent.click(within(typeSection).getByRole("radio", { name: "Todos" }));
    expect(onType).toHaveBeenCalledWith("");
    expect(screen.getByRole("dialog", { name: "Filtros y orden" })).toBeInTheDocument();
  });

  it("sorts by the chosen column and switches direction through onSort", () => {
    stubContainerWidth(400);
    const onSort = vi.fn();
    cardTable({ columns: filterColumns(), orderBy: "startAt", order: "asc", onSort });
    fireEvent.click(screen.getByTestId("items-table-filters-button"));
    const sort = screen.getByRole("radiogroup", { name: "Ordenar por" });
    expect(within(sort).getByRole("radio", { name: "Fecha y hora" })).toBeChecked();

    fireEvent.click(within(sort).getByRole("radio", { name: "Estado" }));
    expect(onSort).toHaveBeenLastCalledWith("status");

    onSort.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Ascendente" }));
    expect(onSort).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Descendente" }));
    expect(onSort).toHaveBeenCalledWith("startAt");
  });

  it("clears every filter with Limpiar and closes with Ver resultados", () => {
    stubContainerWidth(400);
    const onType = vi.fn();
    const onStatus = vi.fn();
    cardTable({ columns: filterColumns(onType, onStatus) });
    fireEvent.click(screen.getByTestId("items-table-filters-button"));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(onType).toHaveBeenCalledWith("");
    expect(onStatus).toHaveBeenCalledWith([]);

    fireEvent.click(screen.getByRole("button", { name: "Ver resultados" }));
    expect(screen.queryByRole("dialog", { name: "Filtros y orden" })).toBeNull();
  });
});
