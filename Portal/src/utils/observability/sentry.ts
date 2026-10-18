"use client";

import * as Sentry from "@sentry/browser";
import { scrubBrowserEvent } from "./scrub";

let initialized = false;

/** No-op unless NEXT_PUBLIC_SENTRY_DSN is set. No replay, no tracing, no breadcrumbs, no PII. */
export function initBrowserSentry(): boolean {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn || initialized || typeof window === "undefined") return initialized;
    Sentry.init({
        dsn,
        // `next build` inlines NODE_ENV as "production" for every deployed build (staging included),
        // so prefer an explicit name, then Vercel's (production/preview).
        environment:
            process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
            process.env.NEXT_PUBLIC_VERCEL_ENV ||
            process.env.NODE_ENV,
        ...(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA && {
            release: `patientnova-portal@${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA}`,
        }),
        // Sentry 11 collects request data by default; switch every collector off (defense in depth,
        // `beforeSend` also scrubs). Nothing about patients or providers may leave our infrastructure.
        dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
            databaseQueryData: false,
            queues: false,
            graphQL: { document: false, variables: false },
            genAI: { inputs: false, outputs: false },
        },
        tracesSampleRate: 0,
        maxBreadcrumbs: 0,
        beforeSend: (event) => scrubBrowserEvent(event),
    });
    initialized = true;
    return true;
}

export function reportClientError(error: unknown): void {
    if (initialized) Sentry.captureException(error);
}
