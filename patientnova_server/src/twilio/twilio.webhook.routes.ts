import { Router, type Request, type Response } from 'express';
import { twilioWebhookAuth } from '../middlewares/twilioWebhookAuth.js';
import { twilioWebhookService } from './twilio-webhook.service.js';

export const twilioWebhookRouter = Router();

const TWIML_EMPTY_RESPONSE = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/**
 * POST /webhooks/twilio/whatsapp-reply
 *
 * Twilio calls this endpoint when a patient taps a quick-reply button on an
 * appointment-reminder WhatsApp template.
 *
 * Expected fields in the URL-encoded body:
 *   From          — patient's WhatsApp number, e.g. "whatsapp:+15551234567"
 *   ButtonPayload — button identifier set in the template: "confirm" | "cancel"
 *   Body          — human-readable button text, e.g. "Confirmar cita"
 */
twilioWebhookRouter.post(
  '/',
  twilioWebhookAuth,
  async (req: Request, res: Response) => {
    // Always respond with an empty TwiML response so Twilio doesn't retry
    res.set('Content-Type', 'text/xml');

    await twilioWebhookService.processWhatsAppReply({
      from: req.body.From,
      buttonPayload: req.body.ButtonPayload,
      body: req.body.Body,
    });

    res.status(200).send(TWIML_EMPTY_RESPONSE);
  },
);
