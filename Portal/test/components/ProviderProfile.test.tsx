import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderHeader } from "@/src/components/PublicBooking/ProviderHeader";
import { ProviderPanel, ProviderProfile, ProviderProfileSheet } from "@/src/components/PublicBooking/ProviderProfile";
import type { PublicProvider } from "@/src/types/PublicBooking";

const BIO = "Acompaño a adultos y parejas. ".repeat(40).trim();

const provider = {
    displayName: "Dra. Ana Pública",
    jobTitle: "Psicóloga",
    specialty: "Psicología clínica",
    bio: BIO,
    phone: "+573001234567",
    whatsapp: "+573007654321",
    hasAvatar: false,
    hasLogo: false,
    locations: [
        { id: "l1", name: "Consultorio", address: "Calle 10", isVirtual: false },
        { id: "l2", name: "En línea", address: null, isVirtual: true },
    ],
} as PublicProvider;

const sparse = { ...provider, jobTitle: null, specialty: null, bio: null, phone: null, whatsapp: null, locations: [] } as PublicProvider;

const before = (a: Element, b: Element) => expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("ProviderHeader", () => {
    it("shows the name as the page heading with role, specialty, Ver perfil and Mis citas", async () => {
        const user = userEvent.setup();
        const onOpenProfile = vi.fn();
        render(<ProviderHeader slug="dra-ana" provider={provider} appointmentsHref="/book/dra-ana/appointments" onOpenProfile={onOpenProfile} />);

        expect(screen.getByRole("heading", { level: 1, name: "Dra. Ana Pública" })).toBeInTheDocument();
        expect(screen.getByText("Psicóloga · Psicología clínica")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Mis citas" })).toHaveAttribute("href", "/book/dra-ana/appointments");
        await user.click(screen.getByRole("button", { name: "Ver perfil" }));
        expect(onOpenProfile).toHaveBeenCalledOnce();
    });

    it("the compact header opens the profile from the name and offers Atrás", async () => {
        const user = userEvent.setup();
        const onOpenProfile = vi.fn();
        const onBack = vi.fn();
        render(<ProviderHeader slug="dra-ana" provider={provider} compact onOpenProfile={onOpenProfile} onBack={onBack} />);

        await user.click(screen.getByRole("button", { name: "Dra. Ana Pública" }));
        expect(onOpenProfile).toHaveBeenCalledOnce();
        await user.click(screen.getByRole("button", { name: "Atrás" }));
        expect(onBack).toHaveBeenCalledOnce();
    });

    it("the compact header keeps a plain name when no profile can open", () => {
        render(<ProviderHeader slug="dra-ana" provider={provider} compact />);
        expect(screen.getByRole("heading", { level: 1, name: "Dra. Ana Pública" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Dra. Ana Pública" })).toBeNull();
    });
});

describe("ProviderProfile", () => {
    it("orders contact, then the bio, then the places", () => {
        render(<ProviderProfile slug="dra-ana" provider={provider} />);
        before(screen.getByRole("heading", { name: "Dra. Ana Pública" }), screen.getByRole("link", { name: "WhatsApp" }));
        before(screen.getByRole("link", { name: "WhatsApp" }), screen.getByText(BIO));
        before(screen.getByText(BIO), screen.getByText("Consultorio"));
    });

    it("shows the whole bio with no Ver más", () => {
        render(<ProviderProfile slug="dra-ana" provider={provider} />);
        expect(screen.getByText(BIO)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Ver más" })).toBeNull();
    });

    it("links to WhatsApp and the phone", () => {
        render(<ProviderProfile slug="dra-ana" provider={provider} />);
        expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/573007654321");
        expect(screen.getByRole("link", { name: "Llamar al +57 300 123 4567" })).toHaveAttribute("href", "tel:+573001234567");
    });

    it("gives an in-person place a map link and a video place none", () => {
        render(<ProviderProfile slug="dra-ana" provider={provider} />);
        const places = within(screen.getByRole("list", { name: "Dónde atiende" })).getAllByRole("listitem");
        expect(within(places[ 0 ]!).getByRole("link", { name: "Ver en el mapa" })).toHaveAttribute("href", expect.stringContaining("Calle%2010"));
        expect(within(places[ 1 ]!).getByText("Videollamada")).toBeInTheDocument();
        expect(within(places[ 1 ]!).queryByRole("link")).toBeNull();
    });

    it("hides empty parts and shows initials when the profile is sparse", () => {
        render(<ProviderProfile slug="dra-ana" provider={sparse} />);
        expect(screen.getByText("AP")).toBeInTheDocument();
        expect(screen.queryByText("Acerca de")).toBeNull();
        expect(screen.queryByText("Dónde atiende")).toBeNull();
        expect(screen.queryByRole("list", { name: "Contacto" })).toBeNull();
    });

    it("shows the logo above the name when there is one", () => {
        const { container } = render(<ProviderProfile slug="dra-ana" provider={{ ...provider, hasLogo: true }} />);
        const logo = container.querySelector("img[src$='/logo']")!;
        before(logo, screen.getByRole("heading", { name: "Dra. Ana Pública" }));
    });

    it("can be the page's main heading", () => {
        render(<ProviderProfile slug="dra-ana" provider={provider} headingLevel={1} />);
        expect(screen.getByRole("heading", { level: 1, name: "Dra. Ana Pública" })).toBeInTheDocument();
    });
});

describe("ProviderPanel", () => {
    const panel = (p: PublicProvider = provider) => render(<ProviderPanel slug="dra-ana" provider={p} appointmentsHref="/book/dra-ana/appointments" />);

    /** jsdom lays nothing out, so a long bio has to say it overflows. */
    function bioOverflows(overflows: boolean) {
        vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(overflows ? 300 : 138);
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(138);
    }
    afterEach(() => vi.restoreAllMocks());

    it("shows who the provider is, how to reach them and Mis citas, with the name as the page heading", () => {
        panel();

        expect(screen.getByRole("heading", { level: 1, name: "Dra. Ana Pública" })).toBeInTheDocument();
        expect(screen.getByText("Psicóloga · Psicología clínica")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "WhatsApp" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 2, name: "Acerca de" })).toBeInTheDocument();
        expect(screen.getByText(BIO)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Mis citas" })).toHaveAttribute("href", "/book/dra-ana/appointments");
    });

    it("leaves the places to the first step, where they are the choice", () => {
        panel();

        expect(screen.queryByRole("list", { name: "Dónde atiende" })).not.toBeInTheDocument();
        expect(screen.queryByText("Consultorio")).not.toBeInTheDocument();
    });

    it("drops what the provider did not publish", () => {
        panel(sparse);

        expect(screen.queryByRole("heading", { name: "Acerca de" })).not.toBeInTheDocument();
        expect(screen.queryByRole("list", { name: "Contacto" })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Mis citas" })).toBeInTheDocument();
    });

    it("offers no Leer más for a bio that fits", () => {
        bioOverflows(false);
        panel();

        expect(screen.queryByRole("button", { name: "Leer más" })).not.toBeInTheDocument();
    });

    it("cuts a long bio, and Leer más opens and closes it", async () => {
        bioOverflows(true);
        const user = userEvent.setup();
        panel();

        const bio = screen.getByText(BIO);
        expect(bio).toHaveAttribute("data-clamped");
        const more = screen.getByRole("button", { name: "Leer más" });
        expect(more).toHaveAttribute("aria-expanded", "false");

        await user.click(more);
        expect(bio).not.toHaveAttribute("data-clamped");
        const less = screen.getByRole("button", { name: "Leer menos" });
        expect(less).toHaveAttribute("aria-expanded", "true");

        await user.click(less);
        expect(bio).toHaveAttribute("data-clamped");
    });
});

describe("ProviderProfileSheet", () => {
    it("is a dialog named after the provider, closed with the given label", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<ProviderProfileSheet slug="dra-ana" provider={provider} closeLabel="Volver a la reserva" onClose={onClose} />);

        expect(screen.getByRole("dialog", { name: "Perfil de Dra. Ana Pública" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Volver a la reserva" }));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
