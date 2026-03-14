import twilio, { type Twilio } from 'twilio';
import { config } from './config.js';
import { logger } from './logger.js';
import type { SendWhatsAppRequest, NotificationResult, SendSmsRequest } from './types.js';


let _client: Twilio | null = null;

function getClient(): Twilio {
  if (!_client) {
    _client = twilio(config.twilio.accountSid, config.twilio.authToken);
    logger.info('Twilio client initialised');
  }
  return _client;
}

function validateE164(phone: string): void {
  const e164 = /^\+[1-9]\d{7,14}$/;
  if (!e164.test(phone)) {
    throw new Error(
      `Invalid phone number "${phone}". Must be E.164 format, e.g. +15551234567`
    );
  }
}

export async function sendWhatsApp(
  req: SendWhatsAppRequest
): Promise<NotificationResult> {
  validateE164(req.to);

  const to = `whatsapp:${req.to}`;
  const from = config.twilio.whatsappFrom;

  logger.info({ to, from }, 'Sending WhatsApp message');

  const messageParams: Parameters<Twilio[ 'messages' ][ 'create' ]>[ 0 ] =
  {
    from,
    to,
    contentSid: req.contentSid,
    ...(req.contentVariables
      ? { contentVariables: JSON.stringify(req.contentVariables) }
      : {}),
  }

  const message = await getClient().messages.create(messageParams);

  logger.info({ sid: message.sid, status: message.status }, 'WhatsApp message queued');

  return {
    success: true,
    messageSid: message.sid,
    channel: 'whatsapp',
    to: req.to,
    sentAt: new Date().toISOString(),
  };
}

export async function sendSms(req: SendSmsRequest): Promise<NotificationResult> {
  validateE164(req.to);

  if (!req.body?.trim()) {
    throw new Error('"body" is required and cannot be empty');
  }

  logger.info({ to: req.to }, 'Sending SMS');

  const message = await getClient().messages.create({
    from: config.twilio.smsFrom,
    to: req.to,
    body: req.body,
  });

  logger.info({ sid: message.sid, status: message.status }, 'SMS queued');

  return {
    success: true,
    messageSid: message.sid,
    channel: 'sms',
    to: req.to,
    sentAt: new Date().toISOString(),
  };
}

export async function getMessageStatus(messageSid: string) {
  const message = await getClient().messages(messageSid).fetch();
  return {
    sid: message.sid,
    status: message.status,
    to: message.to,
    from: message.from,
    body: message.body,
    errorCode: message.errorCode,
    errorMessage: message.errorMessage,
    dateSent: message.dateSent,
    dateUpdated: message.dateUpdated,
    price: message.price,
    priceUnit: message.priceUnit,
  };
}
