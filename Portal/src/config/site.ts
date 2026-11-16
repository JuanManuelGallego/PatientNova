/**
 * The public, canonical origin of the Portal. Canonical links, the sitemap and robots.txt point here
 * on every deployment, so previews and staging never compete with production in search results.
 * `patientnova.net` redirects to this host; change both together.
 */
export const SITE_URL = "https://www.patientnova.net";

/** Public pages listed in the sitemap. Booking pages are `noindex` and stay out of it. */
export const INDEXABLE_PATHS = [ "/", "/privacy-policy", "/terms-of-service", "/patient-terms" ] as const;
