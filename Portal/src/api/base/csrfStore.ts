/**
 * In-memory holder for the portal session's CSRF token. The API cookie is not readable from the
 * Portal origin, so the server returns the token in a response body (otp verify / session) and
 * it is sent back as `X-CSRF-Token`. Memory only: never localStorage/cookies, gone on reload
 * (the session endpoint re-issues it).
 */
let token: string | null = null;

export const csrfStore = {
    get: () => token,
    set: (value: string) => { token = value; },
    clear: () => { token = null; },
};
