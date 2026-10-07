import pino, { type DestinationStream } from 'pino';
import { getRequestId } from './request-context.js';
import { resolveNodeEnv } from '../config/node-env.js';

const transport = resolveNodeEnv(process.env.NODE_ENV) !== 'production'
  ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
    },
  }
  : undefined

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local[0]}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length <= 4 ? '***' : `***${digits.slice(-4)}`;
}

const PII_KEYS = [
  'email',
  'to',
  'lastName',
  'phone',
  'phoneNumber',
  'whatsappNumber',
  'smsNumber',
  'recipient',
  'subject',
];

const REDACT_PATHS = [
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'token',
  'refreshToken',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.newPassword',
  'req.body.currentPassword',
  'req.body.token',
  'req.body.refreshToken',
  'secret',
  'authToken',
  'contentVariables',
  'body.name',
  'patient.name',
  ...PII_KEYS,
  ...PII_KEYS.map((k) => `*.${k}`),
];

/** Receives every error/fatal log line (the error, if one was logged, and the message). */
export type ErrorReporter = (report: { err?: unknown; msg?: string; requestId?: string }) => void;

let errorReporter: ErrorReporter | undefined;

/** Error tracking hooks in here, so HTTP, worker, cron and startup failures are all reported. */
export function setErrorReporter(reporter: ErrorReporter | undefined): void {
  errorReporter = reporter;
}

const PINO_ERROR_LEVEL = 50;

function reportLogged(args: unknown[]): void {
  const [first, second] = args;
  const obj = first !== null && typeof first === 'object' && !(first instanceof Error)
    ? first as Record<string, unknown>
    : undefined;
  const err = first instanceof Error ? first : obj?.err ?? obj?.error;
  const msg = typeof first === 'string' ? first : typeof second === 'string' ? second : undefined;
  const requestId = typeof obj?.requestId === 'string' ? obj.requestId : getRequestId();
  try {
    errorReporter?.({
      ...(err !== undefined && { err }),
      ...(msg !== undefined && { msg }),
      ...(requestId !== undefined && { requestId }),
    });
  } catch {
    // Error tracking must never break logging.
  }
}

export function buildLogger(destination?: DestinationStream) {
  const options = {
    hooks: {
      logMethod(this: pino.Logger, args: Parameters<pino.LogFn>, method: pino.LogFn, level: number) {
        if (level >= PINO_ERROR_LEVEL && errorReporter) reportLogged(args);
        return method.apply(this, args);
      },
    },
    level: process.env.LOG_LEVEL ?? 'info',
    mixin: () => {
      const requestId = getRequestId();
      return requestId ? { requestId } : {};
    },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  };
  return destination
    ? pino(options, destination)
    : pino({ ...options, ...(transport && { transport }) });
}

export const logger = buildLogger();
