import pino from 'pino';

const transport = process.env.NODE_ENV !== 'production'
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

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: transport as any,
  redact: {
    paths: [
      'password',
      'newPassword',
      'currentPassword',
      'passwordHash',
      'token',
      'refreshToken',
      'authorization',
      'req.headers.authorization',
      'req.body.password',
      'req.body.newPassword',
      'req.body.currentPassword',
      'req.body.token',
      'req.body.refreshToken',
      'secret',
      'authToken',
      'contentVariables',
    ],
    censor: '[REDACTED]',
  },
});
