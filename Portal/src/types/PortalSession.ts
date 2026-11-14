import type { LoginChannel } from "@/src/types/PublicBooking";

export interface PortalSession {
    contact: string;
    contactChannel: LoginChannel;
    expiresAt: string;
    csrfToken: string;
    providerSlug: string;
    consentRequired: boolean;
    bookingOpen: boolean;
}
