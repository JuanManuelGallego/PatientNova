import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicFooter, PublicHeader, TrustStrip } from "@/src/components/PublicBooking/PublicChrome";

describe("public booking chrome", () => {
  it("shows the Patient Nova brand and logo in the header", () => {
    const { container } = render(<PublicHeader />);
    expect(screen.getByText("Patient Nova")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/favicon.ico");
  });

  it("links to the patient's appointments when given a target", () => {
    render(<PublicHeader appointmentsHref="/book/dra-ana/appointments" />);
    const account = screen.getByRole("navigation", { name: "Cuenta" });
    expect(within(account).getByRole("link", { name: "Mis citas" })).toHaveAttribute("href", "/book/dra-ana/appointments");
  });

  it("omits the appointments link without a target", () => {
    render(<PublicHeader />);
    expect(screen.queryByRole("navigation", { name: "Cuenta" })).not.toBeInTheDocument();
  });

  it("links the legal pages and support from the footer", () => {
    render(<PublicFooter />);
    const legal = screen.getByRole("navigation", { name: "Legal y soporte" });
    expect(within(legal).getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("href", "/privacy-policy");
    expect(within(legal).getByRole("link", { name: "Términos de servicio" })).toHaveAttribute("href", "/terms-of-service");
    expect(within(legal).getByRole("link", { name: "Soporte" })).toHaveAttribute("href", "mailto:support@patientnova.net");
  });

  it("opens legal links in a new tab without leaking the opener", () => {
    render(<PublicFooter />);
    const privacy = screen.getByRole("link", { name: "Política de privacidad" });
    expect(privacy).toHaveAttribute("target", "_blank");
    expect(privacy).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("lists the three booking guarantees", () => {
    render(<TrustStrip />);
    const list = screen.getByRole("list", { name: "Garantías de la reserva" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("Sin contraseña")).toBeInTheDocument();
  });
});
