import dotenv from 'dotenv';
dotenv.config();

import { resolveNodeEnv } from './node-env.js';

function requireEnv(key: string): string {
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
    timeoutMs: parseInt(process.env.CAPTCHA_TIMEOUT_MS ?? '3000', 10),
  };
}

function portalAuthSecret(): string {
  const secret = process.env.ENABLE_PORTAL === 'true' ? requireEnv('PORTAL_AUTH_SECRET') : (process.env.PORTAL_AUTH_SECRET ?? '');
  if (secret && secret === process.env.AUTH_SECRET) throw new Error('PORTAL_AUTH_SECRET must differ from AUTH_SECRET');
  return secret;
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
  return { key, blindIndexKey };
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),

  databaseUrl: requireEnv('DATABASE_URL'),

  database: {
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE ?? '20', 10),
    poolMin: parseInt(process.env.DATABASE_POOL_MIN ?? '5', 10),
    connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT ?? '10000', 10),
    idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT ?? '30000', 10),
  },

  twilio: {
    accountSid: requireEnv('TWILIO_ACCOUNT_SID'),
    authToken: requireEnv('TWILIO_AUTH_TOKEN'),
    whatsappFrom: requireEnv('TWILIO_WHATSAPP_FROM'),
    smsFrom: requireEnv('TWILIO_SMS_FROM'),
    webhookBaseUrl: requireEnv('TWILIO_WEBHOOK_BASE_URL'),
    tomorrowAppointmentsReminderSid: requireEnv('TWILIO_WHATSAPP_USER_REMINDER_SID'),
    tomorrowAppointmentsReminder2Sid: requireEnv('TWILIO_WHATSAPP_USER_REMINDER_2_APPT_SID'),
    tomorrowAppointmentsReminder3Sid: requireEnv('TWILIO_WHATSAPP_USER_REMINDER_3_APPT_SID'),
    tomorrowAppointmentsReminder4Sid: requireEnv('TWILIO_WHATSAPP_USER_REMINDER_4_APPT_SID'),
    tomorrowAppointmentsReminder5Sid: requireEnv('TWILIO_WHATSAPP_USER_REMINDER_5_APPT_SID'),
    tomorrowAppointmentsReminder6Sid: requireEnv('TWILIO_WHATSAPP_USER_REMINDER_6_APPT_SID'),
    reminderFailedSid: requireEnv('TWILIO_WHATSAPP_USER_REMINDER_FAILED_SID'),
    appointmentStatusUpdateSid: requireEnv('TWILIO_WHATSAPP_USER_APPOINTMENT_STATUS_UPDATE_SID'),
    appointmentMeetingLinkSid: requireEnv('TWILIO_WHATSAPP_PATIENT_APPOINTMENT_MEETING_LINK_SID'),
  },

  brevo: {
    apiKey: requireEnv('BREVO_API_KEY'),
    apiBaseUrl: process.env.BREVO_API_BASE_URL ?? 'https://api.brevo.com/v3',
    fromEmail: requireEnv('BREVO_FROM_EMAIL'),
    fromName: process.env.BREVO_FROM_NAME ?? undefined,
    webhookSecret: requireEnv('BREVO_WEBHOOK_SECRET'),
    timeoutMs: parseInt(process.env.BREVO_TIMEOUT_MS ?? '10000', 10),
  },

  sentry: {
    dsn: process.env.SENTRY_DSN ?? '',
    // Railway injects the commit SHA and environment name; explicit values win.
    release: process.env.SENTRY_RELEASE
      || (process.env.RAILWAY_GIT_COMMIT_SHA ? `patientnova-server@${process.env.RAILWAY_GIT_COMMIT_SHA}` : ''),
    environment: process.env.SENTRY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || nodeEnv,
  },

  publicRateLimit: {
    windowMs: parseInt(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    maxRequests: parseInt(process.env.PUBLIC_RATE_LIMIT_MAX ?? '60', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),  // 1 min
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10),
  },

  auth: {
    jwtSecret: requireEnv('AUTH_SECRET'),
    portalJwtSecret: portalAuthSecret(),
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  },

  env: nodeEnv,

  cookieDomain: process.env.COOKIE_DOMAIN ?? undefined,

  allowedOrigins: JSON.parse(requireEnv('ALLOWED_ORIGINS')),

  admin: {
    email: requireEnv('ADMIN_EMAIL'),
    password: requireEnv('ADMIN_PASSWORD'),
  },

  lockout: {
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS ?? '5', 10),
    lockoutDurationMs: parseInt(process.env.LOCKOUT_DURATION_MS ?? '900000', 10),  // 15 min
  },

  defaults: {
    timezone: process.env.DEFAULT_TIMEZONE ?? 'America/Bogota',
  },

  scheduler: {
    enabled: process.env.ENABLE_SCHEDULER === 'true',
    dailyReminderHour: parseInt(process.env.DAILY_REMINDER_HOUR ?? '18', 10),  // local hour (0–23)
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    oauthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '',
  },

  portal: {
    url: process.env.PORTAL_URL ?? 'http://localhost:3000',
    patientEnabled: process.env.ENABLE_PORTAL === 'true',
  },

  captcha: captchaConfig(),

  encryption: encryptionConfig(),

} as const;

export const APPT_SID_MAP: Record<number, string> = {
  2: config.twilio.tomorrowAppointmentsReminder2Sid,
  3: config.twilio.tomorrowAppointmentsReminder3Sid,
  4: config.twilio.tomorrowAppointmentsReminder4Sid,
  5: config.twilio.tomorrowAppointmentsReminder5Sid,
  6: config.twilio.tomorrowAppointmentsReminder6Sid,
};
