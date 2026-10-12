/**
 * Security response headers for every Portal route (patient-facing pages included).
 *
 * CSP notes: the Next.js app router emits inline bootstrap scripts, so `script-src` needs
 * 'unsafe-inline' unless nonces are introduced (which forces dynamic rendering). Everything else is
 * locked down: no objects, no framing, same-origin forms, and network access limited to this origin
 * and the API. No third-party analytics/scripts are allowed (the privacy policy promises none).
 * The only exception is Cloudflare Turnstile (bot protection, not analytics), allowed solely when
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, and scoped to its single origin.
 * The policy ships as Report-Only until CSP_ENFORCE=true so violations can be reviewed first.
 */
export interface SecurityHeader {
    key: string;
    value: string;
}

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

interface CspOptions {
    apiUrl?: string | undefined;
    isDev: boolean;
    turnstile?: boolean;
}

export function buildCsp(options: CspOptions): string {
    const apiOrigin = (() => {
        try {
            return options.apiUrl ? new URL(options.apiUrl).origin : undefined;
        } catch {
            return undefined;
        }
    })();

    const connect = [ "'self'", ...(apiOrigin ? [ apiOrigin ] : []) ];
    if (options.isDev) connect.push("http://localhost:3001", "ws://localhost:3000");
    const turnstile = options.turnstile ? [ TURNSTILE_ORIGIN ] : [];

    const directives: Record<string, string[]> = {
        "default-src": [ "'self'" ],
        "script-src": [ "'self'", "'unsafe-inline'", ...(options.isDev ? [ "'unsafe-eval'" ] : []), ...turnstile ],
        "style-src": [ "'self'", "'unsafe-inline'" ],
        "img-src": [ "'self'", "data:", "blob:", "https://flagcdn.com" ],
        "font-src": [ "'self'", "data:" ],
        "connect-src": [ ...connect, ...turnstile ],
        "object-src": [ "'none'" ],
        "base-uri": [ "'self'" ],
        "form-action": [ "'self'" ],
        "frame-ancestors": [ "'none'" ],
        ...(options.turnstile && { "frame-src": [ "'self'", TURNSTILE_ORIGIN ] }),
    };

    return Object.entries(directives)
        .map(([ name, values ]) => `${name} ${values.join(" ")}`)
        .join("; ");
}

export function buildSecurityHeaders(options: CspOptions & { enforceCsp: boolean }): SecurityHeader[] {
    return [
        {
            key: options.enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
            value: buildCsp(options),
        },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ];
}
