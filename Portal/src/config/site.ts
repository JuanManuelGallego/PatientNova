/**
 * The public, canonical origin of the Portal. Canonical links, the sitemap and robots.txt point here
 * on every deployment, so previews and staging never compete with production in search results.
 * `patientnova.net` redirects to this host; change both together.
 */
export const SITE_URL = "https://www.patientnova.net";

export const SUPPORT_EMAIL = "support@patientnova.net";

/**
 * Where "Quiero probarlo" leads: accounts are created by support, so the contact is the sign-up.
 * The prefilled questions are what support needs to set the account up.
 */
export const CONTACT_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Quiero probar Patient Nova")}&body=${
    encodeURIComponent("Hola, me interesa Patient Nova para mi consulta.\n\nMi nombre:\nMi especialidad:\nCiudad:\n")
}`;

/** Support's WhatsApp, in E.164. */
export const SUPPORT_WHATSAPP = "+573044873415";

/** The same contact over WhatsApp, which many professionals answer before email. */
export const WHATSAPP_CONTACT_HREF = `https://wa.me/${SUPPORT_WHATSAPP.slice(1)}?text=${
    encodeURIComponent("Hola, quiero probar Patient Nova para mi consulta.")
}`;

/** Product pages, in the order the nav and footer list them. */
export const MARKETING_PAGES = [
    { path: "/reserva-en-linea", label: "Reserva en línea" },
    { path: "/recordatorios", label: "Recordatorios" },
    { path: "/historia-clinica", label: "Historia clínica" },
    { path: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
] as const;

/** Public pages listed in the sitemap. Booking pages join only when their provider opts in. */
export const INDEXABLE_PATHS = [
    "/",
    ...MARKETING_PAGES.map((p) => p.path),
    "/privacy-policy",
    "/terms-of-service",
    "/patient-terms",
] as const;
