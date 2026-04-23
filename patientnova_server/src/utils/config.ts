import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[ key ];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),

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
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),  // 1 min
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10),
  },

  auth: {
    jwtSecret: requireEnv('AUTH_SECRET'),
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  },

  env: process.env.NODE_ENV ?? 'development',

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
    currency: process.env.DEFAULT_CURRENCY ?? 'COP',
  },

  scheduler: {
    enabled: process.env.ENABLE_SCHEDULER === 'true',
    schedule: process.env.CRON_SCHEDULE ?? '* * * * *',
  },

} as const;

export const APPT_SID_MAP: Record<number, string> = {
  2: config.twilio.tomorrowAppointmentsReminder2Sid,
  3: config.twilio.tomorrowAppointmentsReminder3Sid,
  4: config.twilio.tomorrowAppointmentsReminder4Sid,
  5: config.twilio.tomorrowAppointmentsReminder5Sid,
  6: config.twilio.tomorrowAppointmentsReminder6Sid,
};
