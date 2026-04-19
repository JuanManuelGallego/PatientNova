import twilio, { type Twilio } from 'twilio';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { type SendWhatsAppRequest, type NotificationResult, type SendSmsRequest, Channel, type ScheduleRequest } from '../utils/types.js';
import { validateE164 } from './twilloValidator.js';


let _client: Twilio | null = null;

function getClient(): Twilio {
  if (!_client) {
    _client = twilio(config.twilio.accountSid, config.twilio.authToken);
    logger.info('Twilio client initialised');
  }
  return _client;
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

  logger.info({ sid: message.sid, status: message.status }, 'WhatsApp message successfuly queued');

  return {
    success: message.status === 'queued' || message.status === 'sent',
    messageSid: message.sid,
    channel: Channel.WHATSAPP,
    to: req.to,
    sentAt: new Date().toISOString(),
    error: message.errorMessage,
  };
}


export async function scheduleWhatsApp(
  req: ScheduleRequest
): Promise<NotificationResult> {
  validateE164(req.payload.to);

  const to = `whatsapp:${req.payload.to}`;
  const from = config.twilio.whatsappFrom;

  logger.info({ to, from }, 'Sending WhatsApp message');

  const messageParams: Parameters<Twilio[ 'messages' ][ 'create' ]>[ 0 ] =
  {
    from,
    to,
    sendAt: new Date(req.sendAt),
    contentSid: req.payload.contentSid,
    ...(req.payload.contentVariables
      ? { contentVariables: JSON.stringify(req.payload.contentVariables) }
      : {}),
  }

  const message = await getClient().messages.create(messageParams);

  logger.info({ sid: message.sid, status: message.status }, 'WhatsApp message successfuly queued');

  return {
    success: message.status === 'queued' || message.status === 'sent',
    messageSid: message.sid,
    channel: Channel.WHATSAPP,
    to: req.payload.to,
    sentAt: new Date().toISOString(),
    error: message.errorMessage,
  };
}

export async function sendWhatsAppFreeForm(to: string, body: string): Promise<NotificationResult> {
  validateE164(to);

  const toAddr = `whatsapp:${to}`;
  const from = config.twilio.whatsappFrom;

  logger.info({ to: toAddr, from }, 'Sending free-form WhatsApp reply');

  const message = await getClient().messages.create({ from, to: toAddr, body });

  logger.info({ sid: message.sid, status: message.status }, 'Free-form WhatsApp reply queued');

  return {
    success: message.status === 'queued' || message.status === 'sent',
    messageSid: message.sid,
    channel: Channel.WHATSAPP,
    to,
    sentAt: new Date().toISOString(),
    error: message.errorMessage,
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
    success: message.status === 'queued' || message.status === 'sent',
    messageSid: message.sid,
    channel: Channel.SMS,
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
