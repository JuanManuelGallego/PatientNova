import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[ key ];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
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
    appointmentStatusUpdateSid: requireEnv('TWILIO_WHATSAPP_USER_APPOINTMENT_STATUS_UPDATE_SID'),
    appointmentMeetingLinkSid: requireEnv('TWILIO_WHATSAPP_PATIENT_APPOINTMENT_MEETING_LINK_SID'),
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
    dailyReminderHour: parseInt(process.env.DAILY_REMINDER_HOUR ?? '18', 10),  // local hour (0–23)
  },

  google: {
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    refreshToken: requireEnv('GOOGLE_REFRESH_TOKEN'),
  },

  encryption: {
    key:
      process.env.NODE_ENV === "production"
        ? requireEnv("ENCRYPTION_KEY")
        : (process.env.ENCRYPTION_KEY ?? ""),
  },

} as const;

export const APPT_SID_MAP: Record<number, string> = {
  2: config.twilio.tomorrowAppointmentsReminder2Sid,
  3: config.twilio.tomorrowAppointmentsReminder3Sid,
  4: config.twilio.tomorrowAppointmentsReminder4Sid,
  5: config.twilio.tomorrowAppointmentsReminder5Sid,
  6: config.twilio.tomorrowAppointmentsReminder6Sid,
};
