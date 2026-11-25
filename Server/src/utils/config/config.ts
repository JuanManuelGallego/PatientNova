import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { resolveNodeEnv } from './node-env.js';

export function requireEnv(key: string): string {
  const value = process.env[ key ];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const nodeEnv = resolveNodeEnv(process.env.NODE_ENV);

function captchaConfig() {
  const portalHostname = new URL(process.env.PORTAL_URL ?? 'http://localhost:3000').hostname;
  return {
    secret: requireEnv('CAPTCHA_SECRET'),
    expectedHostnames: (process.env.CAPTCHA_EXPECTED_HOSTNAMES?.trim() || portalHostname)
      .split(',').map((h) => h.trim()).filter(Boolean),
    timeoutMs: 3000,
  };
}

function portalAuthSecret(): string {
  const secret = requireEnv('PORTAL_AUTH_SECRET');
  if (secret && secret === process.env.AUTH_SECRET) throw new Error('PORTAL_AUTH_SECRET must differ from AUTH_SECRET');
  return secret;
}

function positiveIntEnv(key: string, fallback: number): number {
  const raw = process.env[ key ]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer`);
  return value;
}

const HEX_256 = /^[0-9a-f]{64}$/i;
const DEV_BLIND_INDEX_KEY = '6465762d6f6e6c792d626c696e642d696e6465782d6b65792d6e6f742d736563';

function encryptionConfig() {
  const key = nodeEnv === 'production' ? requireEnv('ENCRYPTION_KEY') : (process.env.ENCRYPTION_KEY ?? '');
  const blindIndexKey = nodeEnv === 'production'
    ? requireEnv('BLIND_INDEX_KEY')
    : (process.env.BLIND_INDEX_KEY || DEV_BLIND_INDEX_KEY);
  if (key && !HEX_256.test(key)) throw new Error('ENCRYPTION_KEY must be a 64-character hex string (256 bits)');
  if (!HEX_256.test(blindIndexKey)) throw new Error('BLIND_INDEX_KEY must be a 64-character hex string (256 bits)');
  if (key && key.toLowerCase() === blindIndexKey.toLowerCase()) throw new Error('BLIND_INDEX_KEY must differ from ENCRYPTION_KEY');
  const previousKey = process.env.ENCRYPTION_KEY_PREVIOUS?.trim() || undefined;
  if (previousKey) {
    if (!HEX_256.test(previousKey)) throw new Error('ENCRYPTION_KEY_PREVIOUS must be a 64-character hex string (256 bits)');
    if (!key) throw new Error('ENCRYPTION_KEY_PREVIOUS requires ENCRYPTION_KEY');
    if (previousKey.toLowerCase() === key.toLowerCase()) throw new Error('ENCRYPTION_KEY_PREVIOUS must differ from ENCRYPTION_KEY');
    if (previousKey.toLowerCase() === blindIndexKey.toLowerCase()) throw new Error('ENCRYPTION_KEY_PREVIOUS must differ from BLIND_INDEX_KEY');
  }
  return { key, blindIndexKey, previousKey };
}

export const config = {
  port: positiveIntEnv('PORT', 3001),

  databaseUrl: requireEnv('DATABASE_URL'),

  database: {
    poolSize: positiveIntEnv('DATABASE_POOL_SIZE', 20),
    poolMin: positiveIntEnv('DATABASE_POOL_MIN', 5),
    connectionTimeout: positiveIntEnv('DATABASE_CONNECTION_TIMEOUT', 10000),
    idleTimeout: positiveIntEnv('DATABASE_IDLE_TIMEOUT', 30000),
  },

  // The API's public origin, for links patients open (consent PDFs). Twilio must reach the API at
  // TWILIO_WEBHOOK_BASE_URL, so its origin is the API's public address in every environment.
  publicApiOrigin: new URL(requireEnv('TWILIO_WEBHOOK_BASE_URL')).origin,

  twilio: {
    accountSid: requireEnv('TWILIO_ACCOUNT_SID'),
    authToken: requireEnv('TWILIO_AUTH_TOKEN'),
    whatsappFrom: requireEnv('TWILIO_WHATSAPP_FROM'),
    smsFrom: requireEnv('TWILIO_SMS_FROM'),
    webhookBaseUrl: requireEnv('TWILIO_WEBHOOK_BASE_URL'),
  },

  brevo: {
    apiKey: requireEnv('BREVO_API_KEY'),
    apiBaseUrl: process.env.BREVO_API_BASE_URL ?? 'https://api.brevo.com/v3',
    fromEmail: requireEnv('BREVO_FROM_EMAIL'),
    fromName: process.env.BREVO_FROM_NAME ?? undefined,
    webhookSecret: requireEnv('BREVO_WEBHOOK_SECRET'),
  },

  sentry: {
    dsn: process.env.SENTRY_DSN ?? '',
    // Railway injects the commit SHA and environment name; explicit values win.
    release: process.env.SENTRY_RELEASE
      || (process.env.RAILWAY_GIT_COMMIT_SHA ? `patientnova-server@${process.env.RAILWAY_GIT_COMMIT_SHA}` : ''),
    environment: process.env.SENTRY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || nodeEnv,
  },

  publicRateLimit: {
    windowMs: positiveIntEnv('PUBLIC_RATE_LIMIT_WINDOW_MS', 60000),
    maxRequests: positiveIntEnv('PUBLIC_RATE_LIMIT_MAX', 60),
  },

  rateLimit: {
    windowMs: positiveIntEnv('RATE_LIMIT_WINDOW_MS', 60000),  // 1 min
    maxRequests: positiveIntEnv('RATE_LIMIT_MAX', 30),
  },

  auth: {
    jwtSecret: requireEnv('AUTH_SECRET'),
    portalJwtSecret: portalAuthSecret(),
    // Security policy, not configuration: a typo in env must not weaken hashing. Tests hash with 4
    // rounds for speed.
    bcryptRounds: nodeEnv === 'test' ? 4 : 12,
  },

  env: nodeEnv,

  cookieDomain: process.env.COOKIE_DOMAIN ?? undefined,

  allowedOrigins: JSON.parse(requireEnv('ALLOWED_ORIGINS')),

  // Fixed policy and product defaults below are constants, not env (tests override config directly).
  lockout: {
    maxFailedAttempts: 5,
    lockoutDurationMs: 15 * 60_000,
  },

  defaults: {
    timezone: 'America/Bogota',
  },

  scheduler: {
    enabled: process.env.ENABLE_SCHEDULER === 'true',
    dailyReminderHour: 18,  // local hour (0–23) of the "tomorrow's appointments" summary
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    oauthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '',
  },

  portal: {
    url: process.env.PORTAL_URL ?? 'http://localhost:3000',
    selfServe: process.env.ENABLE_SELF_SERVE === 'true',
    whatsappDailyCap: positiveIntEnv('PORTAL_WHATSAPP_DAILY_CAP', 60),
  },

  captcha: captchaConfig(),

  encryption: encryptionConfig(),

} as const;
