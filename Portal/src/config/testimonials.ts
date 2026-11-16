export interface Testimonial {
    /** Their words, as they said them; trim, never rewrite. */
    quote: string;
    /** As they want to be shown, e.g. "Dra. Ana Pérez". */
    name: string;
    /** Specialty or profession, optionally with city, e.g. "Psicóloga clínica, Medellín". */
    role: string;
}

/**
 * Quotes for the landing page's testimonials section, which stays hidden while this is empty.
 * Only real users, with their written permission to publish their name, role and words.
 */
export const TESTIMONIALS: readonly Testimonial[] = [];
