export interface PortalSession {
    email: string;
    expiresAt: string;
    csrfToken: string;
    providerSlug: string;
    consentRequired: boolean;
    /** Booking is live: the patient may book or reschedule. While false they can still see and cancel. */
    bookingOpen: boolean;
}

export interface OtpChallenge {
    challenge: string;
}

export interface PortalLogin {
    email: string;
    expiresAt: string;
    csrfToken: string;
}
