import { Router, type Request, type Response } from 'express';
import { brevoWebhookAuth } from './brevo-webhook-auth.js';
import { processBrevoEvents, type BrevoEvent } from './brevo-webhook.service.js';
import { logger } from '../utils/api/logger.js';

export const brevoWebhookRouter = Router();

/**
 * POST /events
 * Brevo transactional webhook (push-based email delivery tracking — the EMAIL
 * counterpart of POST /webhooks/twilio/status). Brevo posts one event object
 * per request, or an array when batching is enabled; both are accepted.
 */
brevoWebhookRouter.post(
  '/events',
  brevoWebhookAuth,
  async (req: Request, res: Response) => {
    const body: unknown = req.body;
    const events = Array.isArray(body)
      ? (body as BrevoEvent[])
      : body && typeof body === 'object'
        ? [ body as BrevoEvent ]
        : null;

    if (!events) {
      res.status(400).send('Invalid payload');
      return;
    }

    try {
      await processBrevoEvents(events);
    } catch (err) {
      logger.error({ err, count: events.length }, 'Brevo webhook failed');
    }

    res.status(200).end();
  },
);
