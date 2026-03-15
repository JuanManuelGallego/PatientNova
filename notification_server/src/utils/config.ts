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
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),  // 1 min
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10),
  },
} as const;
