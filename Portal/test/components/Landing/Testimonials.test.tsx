import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Testimonials } from "@/src/components/Landing/Testimonials";

describe("Testimonials", () => {
  it("renders nothing without quotes", () => {
    const { container } = render(<Testimonials items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each quote with its author, role and initials (titles skipped)", () => {
    const { container } = render(
      <Testimonials
        items={[
          { quote: "Mis pacientes agendan solos.", name: "Dra. Ana Pérez", role: "Psicóloga clínica, Medellín" },
          { quote: "Menos ausencias.", name: "Luis Gómez", role: "Fisioterapeuta" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Lo que dicen quienes ya lo usan" })).toBeInTheDocument();
    expect(screen.getByText("Mis pacientes agendan solos.")).toBeInTheDocument();
    expect(screen.getByText("Psicóloga clínica, Medellín")).toBeInTheDocument();
    const avatars = [ ...container.querySelectorAll(".landing-testimonial__avatar") ].map((a) => a.textContent);
    expect(avatars).toEqual([ "AP", "LG" ]);
    expect(container.querySelector(".landing-testimonials")).toHaveAttribute("data-count", "2");
  });
});
