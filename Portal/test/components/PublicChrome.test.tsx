import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicFooter } from "@/src/components/PublicBooking/PublicChrome";

describe("public booking chrome", () => {
  it("shows the Patient Nova logo beside the name", () => {
    render(<PublicFooter />);

    const brand = screen.getByText(/Agenda en línea por/);
    expect(brand).toHaveTextContent("Agenda en línea por Patient Nova");
    // The name is right beside it, so the logo stays decorative.
    expect(brand.parentElement!.querySelector("img[alt='']")).toHaveAttribute("src", expect.stringContaining("favicon.ico"));
  });

  it("links the legal pages and support from the footer", () => {
    render(<PublicFooter />);
    const legal = screen.getByRole("navigation", { name: "Legal y soporte" });
    expect(within(legal).getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("href", "/privacy-policy");
    expect(within(legal).getByRole("link", { name: "Términos para profesionales" })).toHaveAttribute("href", "/terms-of-service");
    expect(within(legal).getByRole("link", { name: "Condiciones del portal" })).toHaveAttribute("href", "/patient-terms");
    expect(within(legal).getByRole("link", { name: "Soporte" })).toHaveAttribute("href", "mailto:support@patientnova.net");
  });

  it("opens legal links in a new tab without leaking the opener", () => {
    render(<PublicFooter />);
    const privacy = screen.getByRole("link", { name: "Política de privacidad" });
    expect(privacy).toHaveAttribute("target", "_blank");
    expect(privacy).toHaveAttribute("rel", "noopener noreferrer");
  });
});
