import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage, { metadata } from "@/src/app/(provider)/page";
import robots from "@/src/app/robots";
import sitemap from "@/src/app/sitemap";
import { metadata as loginMetadata } from "@/src/app/(provider)/login/layout";

const auth = vi.hoisted(() => ({ value: { isAuthenticated: false, initializing: true } }));
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/src/providers/AuthContext", () => ({ useAuthContext: () => auth.value }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/src/components/Modals/LoginModal", () => ({ LoginModal: () => <div role="dialog">login</div> }));
const fetchSlugs = vi.hoisted(() => vi.fn<() => Promise<string[]>>());
vi.mock("@/src/utils/seo/publicProviders", () => ({ fetchIndexableProviderSlugs: fetchSlugs }));

describe("landing page", () => {
  beforeEach(() => {
    replace.mockClear();
    auth.value = { isAuthenticated: false, initializing: true };
  });

  it("renders its content while the session probe is still pending (crawlers see it)", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Agenda, reservas en línea e historia clínica para tu consulta");
    expect(screen.getByText("Recordatorios automáticos")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("links every product page from its cards and footer", () => {
    render(<LandingPage />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    for (const path of [ "/reserva-en-linea", "/recordatorios", "/historia-clinica", "/preguntas-frecuentes" ]) {
      expect(hrefs).toContain(path);
    }
  });

  it("opens the login modal from the nav", () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByTestId("landing-login-button"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sends visitors to support from the hero, the nav and the closing banner (accounts are created by support)", () => {
    render(<LandingPage />);
    for (const id of [ "landing-cta-button", "marketing-nav-contact", "marketing-cta-contact" ]) {
      const href = screen.getByTestId(id).getAttribute("href")!;
      expect(href).toMatch(/^mailto:support@patientnova\.net\?subject=Quiero%20probar%20Patient%20Nova&body=/);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers WhatsApp beside email in the hero and the closing banner, in a new tab", () => {
    render(<LandingPage />);
    for (const id of [ "landing-cta-whatsapp", "marketing-cta-whatsapp" ]) {
      const link = screen.getByTestId(id);
      expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/573044873415\?text=Hola%2C%20quiero%20probar/);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("shows the trust strip and answers the price question by sending to support", () => {
    render(<LandingPage />);
    expect(screen.getByRole("region", { name: "Seguridad y soporte" })).toHaveTextContent("Ley 1581 de 2012");
    const price = screen.getByText("¿Cuánto cuesta?").closest("details")!;
    expect(price).toHaveTextContent("planes y precios");
    expect(price.querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
  });

  it("hides the feature icons from assistive technology, so card titles are read once", () => {
    const { container } = render(<LandingPage />);
    const icons = container.querySelectorAll(".landing-feature-card__icon");
    expect(icons.length).toBe(6);
    icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"));
    expect(container.querySelectorAll(".landing-feature-card--link")).toHaveLength(3);
  });

  it("shows no testimonials section while there are none", () => {
    render(<LandingPage />);
    expect(screen.queryByRole("heading", { name: "Lo que dicen quienes ya lo usan" })).not.toBeInTheDocument();
  });

  it("stays light even when the provider saved the dark theme", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector(".marketing-frame")).toHaveAttribute("data-theme", "light");
  });

  it("sends a signed-in provider to the dashboard once the probe settles", () => {
    auth.value = { isAuthenticated: true, initializing: false };
    render(<LandingPage />);
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("declares its own title, description and canonical URL", () => {
    expect(metadata.title).toMatch(/Patient Nova/);
    expect(metadata.description).not.toMatch(/Dashboard/);
    expect(metadata.alternates?.canonical).toBe("/");
  });

  it("keeps the preview image its own openGraph would otherwise drop", () => {
    const images = metadata.openGraph?.images;
    expect(JSON.stringify(images)).toContain("/opengraph-image");
  });

  it("embeds WebSite and Organization structured data with an absolute logo", () => {
    const { container } = render(<LandingPage />);
    const json = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.innerHTML);
    const types = json["@graph"].map((n: { "@type": string }) => n["@type"]);
    expect(types).toEqual([ "WebSite", "Organization" ]);
    expect(json["@graph"][1].logo).toBe("https://www.patientnova.net/icon.png");
    expect(json["@graph"][1].contactPoint.telephone).toBe("+573044873415");
  });
});

describe("login page metadata", () => {
  it("is noindex so brand searches land on the landing page", () => {
    expect(loginMetadata.robots).toMatchObject({ index: false });
  });
});

describe("robots and sitemap", () => {
  it("points crawlers at the production sitemap and keeps /book crawlable so its noindex is seen", () => {
    const r = robots();
    expect(r.sitemap).toBe("https://www.patientnova.net/sitemap.xml");
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.disallow).not.toContain("/book");
    expect(rules.disallow).toContain("/dashboard");
  });

  it("lists the product and legal pages, plus only the booking pages the API reports as indexable", async () => {
    fetchSlugs.mockResolvedValue([ "dra-ana" ]);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://www.patientnova.net/");
    expect(urls).toContain("https://www.patientnova.net/reserva-en-linea");
    expect(urls).toContain("https://www.patientnova.net/preguntas-frecuentes");
    expect(urls).toContain("https://www.patientnova.net/privacy-policy");
    expect(urls.filter((u) => u.includes("/book"))).toEqual([ "https://www.patientnova.net/book/dra-ana" ]);
  });

  it("still lists the static pages when the provider list is unavailable", async () => {
    fetchSlugs.mockResolvedValue([]);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://www.patientnova.net/");
    expect(urls.some((u) => u.includes("/book"))).toBe(false);
  });
});
