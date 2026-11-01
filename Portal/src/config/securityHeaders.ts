/**
 * Security response headers for every Portal route (patient-facing pages included).
 *
 * CSP notes: the Next.js app router emits inline bootstrap scripts, so `script-src` needs
 * 'unsafe-inline' unless nonces are introduced (which forces dynamic rendering). Everything else is
 * locked down: no objects, no framing, same-origin forms, and network access limited to this origin
 * and the API. No third-party analytics/scripts are allowed (the privacy policy promises none).
 * The only exception is Cloudflare Turnstile (bot protection, not analytics), scoped to its single origin.
 * The policy ships as Report-Only until CSP_ENFORCE=true so violations can be reviewed first.
 */
export interface SecurityHeader {
    key: string;
    value: string;
}

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

interface CspOptions {
    apiUrl?: string | undefined;
    sentryDsn?: string | undefined;
    isDev: boolean;
}

function originOf(url: string | undefined): string | undefined {
    if (!url) return undefined;
    try {
        return new URL(url).origin;
    } catch {
        return undefined;
    }
}

export function buildCsp(options: CspOptions): string {
    const apiOrigin = originOf(options.apiUrl);
    const connect = [ "'self'", ...[ apiOrigin, originOf(options.sentryDsn) ].filter((o): o is string => !!o) ];
    if (options.isDev) connect.push("http://localhost:3001", "ws://localhost:3000");
    // The public booking page loads the provider's avatar/logo from the API.
    const img = [ "'self'", "data:", "blob:", "https://flagcdn.com", ...(apiOrigin ? [ apiOrigin ] : []), ...(options.isDev ? [ "http://localhost:3001" ] : []) ];

    const directives: Record<string, string[]> = {
        "default-src": [ "'self'" ],
        "script-src": [ "'self'", "'unsafe-inline'", ...(options.isDev ? [ "'unsafe-eval'" ] : []), TURNSTILE_ORIGIN ],
        "style-src": [ "'self'", "'unsafe-inline'" ],
        "img-src": img,
        "font-src": [ "'self'", "data:" ],
        "connect-src": [ ...connect, TURNSTILE_ORIGIN ],
        "object-src": [ "'none'" ],
        "base-uri": [ "'self'" ],
        "form-action": [ "'self'" ],
        "frame-ancestors": [ "'none'" ],
        "frame-src": [ "'self'", TURNSTILE_ORIGIN ],
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
