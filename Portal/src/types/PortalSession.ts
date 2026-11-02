export interface PortalSession {
    email: string;
    expiresAt: string;
    csrfToken: string;
    providerSlug: string;
    consentRequired: boolean;
}

export interface OtpChallenge {
    challenge: string;
}

export interface PortalLogin {
    email: string;
    expiresAt: string;
    csrfToken: string;
}
