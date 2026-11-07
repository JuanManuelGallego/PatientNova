import { describe, expect, it } from "vitest";
import { accessNotice, consentLabel, consentNotice, controllerLine } from "@/src/config/consentText";

const provider = {
    displayName: "Dra. Pérez",
    phone: "+573001112222",
    whatsapp: null,
    legal: { name: "Consultorio Pérez S.A.S.", privacyContact: "datos@perez.co", contactHours: "Lunes a viernes, 8:00 a 17:00" },
};

describe("consent text", () => {
    it("names the legal controller, not only the public name", () => {
        expect(controllerLine(provider)).toContain("Responsable del tratamiento: Consultorio Pérez S.A.S., datos@perez.co.");
        expect(consentLabel(provider)).toContain("Autorizo expresamente a Consultorio Pérez S.A.S.");
        expect(accessNotice(provider)).toContain("Consultorio Pérez S.A.S.");
    });

    it("says health data is involved and the portal is optional, with a real way out", () => {
        const notice = consentNotice(provider);
        expect(notice).toContain("No estás obligado a autorizar el tratamiento de datos sensibles");
        expect(notice).toContain("Este portal es voluntario");
        expect(notice).toContain("+573001112222, Lunes a viernes, 8:00 a 17:00");
        expect(consentLabel(provider)).toContain("datos de salud");
    });

    it("offers both ways of reaching the clinic when they differ", () => {
        expect(consentNotice({ ...provider, whatsapp: "+573003334444" })).toContain("+573001112222 o WhatsApp +573003334444");
        expect(consentNotice({ ...provider, whatsapp: provider.phone })).not.toContain("WhatsApp");
    });

    it("falls back to the public name while the legal identity is missing", () => {
        const bare = { ...provider, legal: null };
        expect(controllerLine(bare)).toBe("Responsable del tratamiento: Dra. Pérez. Patient Nova opera este portal por su cuenta.");
        expect(consentLabel(bare)).toContain("Autorizo expresamente a Dra. Pérez");
    });
});
