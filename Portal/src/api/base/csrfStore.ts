/**
 * In-memory holder for the portal session's CSRF token. The API cookie is not readable from the
 * Portal origin, so the server returns the token in a response body (otp verify / session) and
 * it is sent back as `X-CSRF-Token`. Memory only: never localStorage/cookies, gone on reload
 * (the session endpoint re-issues it).
 *
 * Browser-only: on the Next.js server this module is shared by every request, so a stored token
 * would leak across patients. `set` refuses to run there and `get` never returns a token.
 */
let token: string | null = null;

const isBrowser = () => typeof window !== "undefined";

export const csrfStore = {
    get: () => (isBrowser() ? token : null),
    set: (value: string) => {
        if (!isBrowser()) throw new Error("csrfStore is browser-only; portalApi must not run on the server");
        token = value;
    },
    clear: () => { token = null; },
};
