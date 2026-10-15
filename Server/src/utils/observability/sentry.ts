import * as Sentry from '@sentry/node';
import { config } from '../config/config.js';
import { logger, setErrorReporter, type ErrorReporter } from '../api/logger.js';
import { scrubEvent, scrubText } from './scrub.js';

/**
 * No-op unless SENTRY_DSN is set. No tracing, no breadcrumbs, no default PII. Every `logger.error`/
 * `logger.fatal` line is reported (HTTP 5xx, pg-boss workers, cron, startup), so there are no
 * per-call-site capture calls.
 */
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
    // Sentry's default handler only warns, which would keep a broken process alive once a DSN is
    // set. Strict mirrors Node's default (crash), so enabling error tracking never changes failure mode.
    integrations: [Sentry.onUnhandledRejectionIntegration({ mode: 'strict' })],
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeSend: (event) => scrubEvent(event),
  });
  setErrorReporter(reportToSentry);
  logger.info('Sentry error reporting enabled');
  return true;
}

const reportToSentry: ErrorReporter = ({ err, msg, requestId }) => {
  Sentry.withScope((scope) => {
    if (requestId) scope.setTag('requestId', requestId);
    // Tags bypass beforeSend, so the message is scrubbed here.
    if (msg) scope.setTag('logMessage', scrubText(msg).slice(0, 200));
    if (err !== undefined) Sentry.captureException(err);
    else if (msg) Sentry.captureMessage(msg, 'error');
  });
};
