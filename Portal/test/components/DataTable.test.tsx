import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
