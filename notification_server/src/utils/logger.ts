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

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: transport as any,
});
