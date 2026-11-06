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

export interface OtpChallenge {
    challenge: string;
}

export type OtpRequestContact = { email: string } | { phone: string; channel: LoginChannel };
export type OtpVerifyContact = { email: string } | { phone: string };

export interface PortalLogin {
    contact: string;
    contactChannel: LoginChannel;
    expiresAt: string;
    csrfToken: string;
}
