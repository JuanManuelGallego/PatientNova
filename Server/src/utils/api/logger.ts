import pino, { type DestinationStream } from 'pino';
import { getRequestId } from './request-context.js';

// Pretty output only when NODE_ENV is explicitly a non-production value; unset means production.
const transport = process.env.NODE_ENV && process.env.NODE_ENV !== 'production'
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

/**
 * Mask an email for safe logging: "j***@example.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local[0]}***@${domain}`;
}

/**
 * Mask a phone number for safe logging: "***1234"
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length <= 4 ? '***' : `***${digits.slice(-4)}`;
}

// Personal data that must never reach logs, at the top level and one level deep
// (e.g. `{ patient: { email } }`, `{ body: { to } }`).
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

// Error messages, stacks and SDK metadata can contain patient data or SQL arguments.
// Keep only the error class and machine-readable code in logs.
function serializeError(err: unknown) {
  const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
  return {
    type: err instanceof Error ? err.constructor.name : 'Error',
    ...((typeof code === 'number' && Number.isInteger(code)) ||
      (typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,31}$/.test(code)) ? { code } : {}),
  };
}

export function buildLogger(destination?: DestinationStream) {
  const options = {
    level: process.env.LOG_LEVEL ?? 'info',
    serializers: { err: serializeError, error: serializeError, auditError: serializeError },
    // Adds the current request id (if any) to every log line.
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
