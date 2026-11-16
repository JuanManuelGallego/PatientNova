import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCard } from "@/src/components/Info/StatCard";

describe("StatCard", () => {
  it("renders the value", () => {
    render(<StatCard label="Activos" value={0} sub="este mes" accent="red" />);
    expect(screen.getByTestId("stat-card-activos")).toHaveTextContent("0");
  });

  it("renders an em dash when the value is unknown", () => {
    render(<StatCard label="Activos" value={undefined} sub="este mes" accent="red" />);
    const card = screen.getByTestId("stat-card-activos");
    expect(card).toHaveTextContent("—");
    expect(card).not.toHaveTextContent("0");
  });

  it("sizes the value by its length instead of cutting it", () => {
    render(<StatCard label="Ingresos" value="$ 12.690.000" sub="total" accent="red" />);
    const value = screen.getByText("$ 12.690.000");
    expect(value.style.getPropertyValue("--stat-chars")).toBe("12");
  });
});
