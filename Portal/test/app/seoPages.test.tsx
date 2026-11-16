import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";
import OnlineBookingPage, { metadata as bookingMeta } from "@/src/app/(marketing)/reserva-en-linea/page";
import RemindersPage, { metadata as remindersMeta } from "@/src/app/(marketing)/recordatorios/page";
import ClinicalRecordPage, { metadata as recordMeta } from "@/src/app/(marketing)/historia-clinica/page";
import FaqPage, { metadata as faqMeta } from "@/src/app/(marketing)/preguntas-frecuentes/page";
import MarketingLayout from "@/src/app/(marketing)/layout";
import { generateMetadata } from "@/src/app/book/[slug]/page";
import { fetchPublicProvider } from "@/src/utils/seo/publicProviders";
import type { PublicProvider } from "@/src/types/PublicBooking";

vi.mock("@/src/components/PublicBooking/PublicBookingPage", () => ({ PublicBookingPage: () => null }));

const PAGES = [
  { name: "reserva en línea", Page: OnlineBookingPage, meta: bookingMeta, path: "/reserva-en-linea" },
  { name: "recordatorios", Page: RemindersPage, meta: remindersMeta, path: "/recordatorios" },
  { name: "historia clínica", Page: ClinicalRecordPage, meta: recordMeta, path: "/historia-clinica" },
  { name: "preguntas frecuentes", Page: FaqPage, meta: faqMeta, path: "/preguntas-frecuentes" },
];

describe.each(PAGES)("product page: $name", ({ Page, meta, path }) => {
  it("has one h1, its own canonical and the shared preview image", () => {
    render(<Page />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(meta.alternates?.canonical).toBe(path);
    expect(String(meta.title)).toMatch(/Patient Nova/);
    expect(JSON.stringify(meta.openGraph?.images)).toContain("/opengraph-image");
  });

  it("links the other product pages and the login page, not itself as a related page", () => {
    render(<Page />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/login");
    for (const other of PAGES.filter((p) => p.path !== path)) expect(hrefs).toContain(other.path);
  });

  it("marks itself as the current page in the nav", () => {
    render(<Page />);
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.getAttribute("href"))).toEqual([ path ]);
  });

  it("offers the contact button in the nav and the closing banner", () => {
    render(<Page />);
    expect(screen.getByTestId("marketing-nav-contact")).toHaveAttribute("href", expect.stringMatching(/^mailto:/));
    expect(screen.getByTestId("marketing-cta-contact")).toHaveAttribute("href", expect.stringMatching(/^mailto:/));
    expect(screen.getByTestId("marketing-cta-whatsapp")).toHaveAttribute("href", expect.stringMatching(/^https:\/\/wa\.me\//));
  });
});

describe("marketing layout", () => {
  it("keeps the product pages light even when the provider saved the dark theme", () => {
    const { container } = render(<MarketingLayout><p>x</p></MarketingLayout>);
    expect(container.firstElementChild).toHaveAttribute("data-theme", "light");
  });
});

function provider(overrides: Partial<PublicProvider> = {}): PublicProvider {
  return {
    displayName: "Ana Pérez", jobTitle: "Psicóloga", specialty: "Psicología clínica", bio: null,
    phone: null, whatsapp: null, legal: null, hasAvatar: false, hasLogo: false, timezone: "America/Bogota",
    bookingOpen: true, indexable: true, approvalRequired: false, selfServe: false, whatsappConfirmation: true,
    reschedulePolicy: null, lastBookableDate: "2026-12-31", types: [], locations: [],
    ...overrides,
  };
}

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

function answer(data: unknown, status = 200) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: status === 200, data }), { status }));
}

const meta = (slug: string) => generateMetadata({ params: Promise.resolve({ slug }) }) as Promise<Metadata>;

describe("booking page metadata", () => {
  it("indexes an opted-in, open provider with their own title, description and canonical", async () => {
    answer(provider({ bio: "Atiendo adultos y parejas en Medellín." }));
    const m = await meta("Dra-Ana");
    expect(m.robots).toMatchObject({ index: true });
    expect(m.title).toBe("Ana Pérez · Psicología clínica | Reservar cita");
    expect(m.description).toBe("Atiendo adultos y parejas en Medellín.");
    expect(m.alternates?.canonical).toBe("/book/dra-ana");
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/public\/providers\/dra-ana$/);
  });

  it("keeps a provider who did not opt in (or is paused) out of search", async () => {
    answer(provider({ indexable: false }));
    expect((await meta("dra-ana")).robots).toMatchObject({ index: false, follow: false });
  });

  it("fails closed when the profile cannot be read", async () => {
    answer(null, 404);
    expect((await meta("nadie")).robots).toMatchObject({ index: false });
    fetchMock.mockRejectedValue(new Error("network down"));
    expect((await meta("dra-ana")).robots).toMatchObject({ index: false });
  });

  it("trims a long bio to a search-sized description and falls back to name and role", async () => {
    answer(provider({ bio: "a".repeat(300) }));
    expect(String((await meta("dra-ana")).description).length).toBeLessThanOrEqual(155);
    answer(provider({ bio: null, specialty: null }));
    expect((await meta("dra-ana")).description).toBe("Reserva en línea tu cita con Ana Pérez, Psicóloga.");
  });

  it("reads the profile through the cached server fetch", async () => {
    answer(provider());
    await fetchPublicProvider("dra-ana");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ next: { revalidate: 300 } });
  });
});
