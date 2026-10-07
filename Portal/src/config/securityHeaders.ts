/**
 * Security response headers for every Portal route (patient-facing pages included).
 *
 * CSP notes: the Next.js app router emits inline bootstrap scripts, so `script-src` needs
 * 'unsafe-inline' unless nonces are introduced (which forces dynamic rendering). Everything else is
 * locked down: no objects, no framing, same-origin forms, and network access limited to this origin
 * and the API. No third-party analytics/scripts are allowed (the privacy policy promises none).
 * The policy ships as Report-Only until CSP_ENFORCE=true so violations can be reviewed first.
 */
export interface SecurityHeader {
    key: string;
    value: string;
}

export function buildCsp(options: { apiUrl?: string | undefined; sentryDsn?: string | undefined; isDev: boolean }): string {
    const apiOrigin = (() => {
        try {
            return options.apiUrl ? new URL(options.apiUrl).origin : undefined;
        } catch {
            return undefined;
        }
    })();

    const sentryOrigin = (() => {
        try {
            return options.sentryDsn ? new URL(options.sentryDsn).origin : undefined;
        } catch {
            return undefined;
        }
    })();

    const connect = [ "'self'", ...(apiOrigin ? [ apiOrigin ] : []), ...(sentryOrigin ? [ sentryOrigin ] : []) ];
    if (options.isDev) connect.push("http://localhost:3001", "ws://localhost:3000");

    const directives: Record<string, string[]> = {
        "default-src": [ "'self'" ],
        "script-src": [ "'self'", "'unsafe-inline'", ...(options.isDev ? [ "'unsafe-eval'" ] : []) ],
        "style-src": [ "'self'", "'unsafe-inline'" ],
        "img-src": [ "'self'", "data:", "blob:", "https://flagcdn.com" ],
        "font-src": [ "'self'", "data:" ],
        "connect-src": connect,
        "object-src": [ "'none'" ],
        "base-uri": [ "'self'" ],
        "form-action": [ "'self'" ],
        "frame-ancestors": [ "'none'" ],
    };

    return Object.entries(directives)
        .map(([ name, values ]) => `${name} ${values.join(" ")}`)
        .join("; ");
}

export function buildSecurityHeaders(options: {
    apiUrl?: string | undefined;
    sentryDsn?: string | undefined;
    isDev: boolean;
    enforceCsp: boolean;
}): SecurityHeader[] {
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
