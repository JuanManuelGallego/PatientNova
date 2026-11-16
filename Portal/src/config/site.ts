/**
 * The public, canonical origin of the Portal. Canonical links, the sitemap and robots.txt point here
 * on every deployment, so previews and staging never compete with production in search results.
 * `patientnova.net` redirects to this host; change both together.
 */
export const SITE_URL = "https://www.patientnova.net";

export const SUPPORT_EMAIL = "support@patientnova.net";

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
