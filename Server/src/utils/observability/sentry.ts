import * as Sentry from '@sentry/node';
import { config } from '../config/config.js';
import { logger } from '../api/logger.js';
import { scrubEvent } from './scrub.js';

let enabled = false;

/** No-op unless SENTRY_DSN is set. Manual capture only: no tracing, no breadcrumbs, no default PII. */
export function initSentry(): boolean {
  if (!config.sentry.dsn) return false;
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.env,
    ...(config.sentry.release && { release: config.sentry.release }),
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
    beforeSend: (event) => scrubEvent(event),
  });
  enabled = true;
  logger.info('Sentry error reporting enabled');
  return true;
}

/** Reports an unexpected (5xx) error. Safe to call when Sentry is disabled. */
export function captureServerError(err: unknown, context: { requestId?: string | undefined } = {}): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (context.requestId) scope.setTag('requestId', context.requestId);
    Sentry.captureException(err);
  });
}
