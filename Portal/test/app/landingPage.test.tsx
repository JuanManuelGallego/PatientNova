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

describe("landing page", () => {
  beforeEach(() => {
    replace.mockClear();
    auth.value = { isAuthenticated: false, initializing: true };
  });

  it("renders its content while the session probe is still pending (crawlers see it)", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("La plataforma moderna para profesionales de la salud");
    expect(screen.getByText("Gestión de pacientes")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("opens the login modal from either button", () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByTestId("landing-cta-button"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("lists the landing page and the legal pages, never booking pages", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain("https://www.patientnova.net/");
    expect(urls).toContain("https://www.patientnova.net/privacy-policy");
    expect(urls.some((u) => u.includes("/book"))).toBe(false);
  });
});
