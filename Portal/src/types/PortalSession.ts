/** `GET /v1/portal/session`: same keys and types whether or not the email belongs to a patient. */
export interface PortalSession {
    email: string;
    expiresAt: string;
    csrfToken: string;
    providerSlug: string;
    consentRequired: boolean;
}

/** `POST /v1/public/providers/:slug/otp` (always 202). Send `challenge` back with the code. */
export interface OtpChallenge {
    challenge: string;
}

/** `POST /v1/portal/:slug/otp/verify`: the cookie is set by the response; the CSRF token stays in memory. */
export interface PortalLogin {
    email: string;
    expiresAt: string;
    csrfToken: string;
}
