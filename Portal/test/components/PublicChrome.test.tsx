import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicFooter, PublicHeader, TrustStrip } from "@/src/components/PublicBooking/PublicChrome";

describe("public booking chrome", () => {
  it("shows the Patient Nova brand, logo and secure badge in the header", () => {
    const { container } = render(<PublicHeader slug="dra-ana" current="book" />);
    expect(screen.getByText("Patient Nova")).toBeInTheDocument();
    expect(screen.getByText("Reserva segura")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/favicon.ico");
  });

  it("links to the patient's appointments from the booking page header", () => {
    render(<PublicHeader slug="dra-ana" current="book" />);
    expect(screen.getByRole("link", { name: "Mis citas" })).toHaveAttribute("href", "/book/dra-ana/appointments");
  });

  it("omits the appointments link on the appointments page", () => {
    render(<PublicHeader slug="dra-ana" current="appointments" />);
    expect(screen.queryByRole("link", { name: "Mis citas" })).not.toBeInTheDocument();
  });

  it("links the legal pages and contact from the footer", () => {
    render(<PublicFooter />);
    const legal = screen.getByRole("navigation", { name: "Legal y contacto" });
    expect(within(legal).getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("href", "/privacy-policy");
    expect(within(legal).getByRole("link", { name: "Términos de servicio" })).toHaveAttribute("href", "/terms-of-service");
    expect(within(legal).getByRole("link", { name: "Contacto" })).toHaveAttribute("href", "mailto:privacidad@patientnova.net");
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
