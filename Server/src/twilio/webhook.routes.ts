import { Router, type Request, type Response } from 'express';
import { twilioWebhookAuth } from '../middlewares/twilio-webhook-auth.js';
import { twilioWebhookService } from './webhook.service.js';
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
