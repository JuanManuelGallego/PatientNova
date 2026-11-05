import type { LoginChannel } from "@/src/types/PublicBooking";

export interface PortalSession {
    /** What the patient proved control of: an email, or a number on `contactChannel`. */
    contact: string;
    contactChannel: LoginChannel;
    expiresAt: string;
    csrfToken: string;
    providerSlug: string;
    consentRequired: boolean;
    bookingOpen: boolean;
}

export interface OtpChallenge {
    challenge: string;
}

/** Where a code goes; the server keeps the channel of a phone code, so verifying never sends it. */
export type OtpRequestContact = { email: string } | { phone: string; channel: LoginChannel };
export type OtpVerifyContact = { email: string } | { phone: string };

export interface PortalLogin {
    contact: string;
    contactChannel: LoginChannel;
    expiresAt: string;
    csrfToken: string;
}
