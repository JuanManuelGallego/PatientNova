import { Router, type Request, type Response } from 'express';
import { twilioWebhookAuth } from '../middlewares/twilio-webhook-auth.js';
import { twilioWebhookService } from './webhook.service.js';
import { processMessageStatusCallback } from './message-status.service.js';
import { logger } from '../utils/api/logger.js';

export const twilioWebhookRouter = Router();

const TWIML_EMPTY_RESPONSE = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

twilioWebhookRouter.post(
  '/',
  twilioWebhookAuth,
  async (req: Request, res: Response) => {
    res.set('Content-Type', 'text/xml');

    const maskedFrom = typeof req.body.From === 'string' ? req.body.From.replace(/^(whatsapp:\+\d{1,3})\d+$/, '$1***') : req.body.From;

    try {
      await twilioWebhookService.processWhatsAppReply({
        from: req.body.From,
        buttonPayload: req.body.ButtonPayload,
        body: req.body.Body,
      });
    } catch (err) {
      logger.error({ err, from: maskedFrom, buttonPayload: req.body.ButtonPayload }, 'Twilio webhook failed');
    }

    res.status(200).send(TWIML_EMPTY_RESPONSE);
  },
);

/**
 * POST /status
 * Twilio message status callback (push-based delivery tracking).
 * Reuses the same HMAC signature validation as the inbound reply webhook.
 * Twilio requires only a 200 (no response body) for status callbacks.
 */
twilioWebhookRouter.post(
  '/status',
  twilioWebhookAuth,
  async (req: Request, res: Response) => {
    try {
      await processMessageStatusCallback({
        messageSid: req.body.MessageSid,
        messageStatus: req.body.MessageStatus,
        errorCode: req.body.ErrorCode,
        errorMessage: req.body.ErrorMessage,
      });
    } catch (err) {
      logger.error({ err, messageSid: req.body.MessageSid }, 'Twilio status callback failed');
    }

    res.status(200).end();
  },
);
