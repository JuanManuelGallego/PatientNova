import { Router, type Request, type Response } from 'express';
import {
  createReminderSchema,
  updateReminderSchema,
  listRemindersSchema,
  uuidParamSchema,
  type ListRemindersQuery,
} from './reminder.schemas.js';
import { reminderRepository } from './reminder.repository.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { logger } from '../utils/logger.js';
import { handleError, ok } from '../utils/apiUtils.js';

export const reminderRouter = Router();

/**
 * GET /reminders
 * List reminders with optional filters and pagination.
 *
 * Query params:
 *   status   — PENDING | SENT | FAILED | CANCELLED
 *   channel  — WHATSAPP | SMS
 *   page     — default 1
 *   pageSize — default 20, max 100
 *   orderBy  — sentAt | createdAt | status  (default: sentAt)
 *   order    — asc | desc  (default: asc)
 */
reminderRouter.get<{}, any, any, ListRemindersQuery>(
  '/',
  validateQuery(listRemindersSchema),
  async (req: Request<{}, any, any, ListRemindersQuery>, res: Response) => {
    try {
      const result = await reminderRepository.findMany(req.query);
      ok(res, result);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * GET /reminders/:id
 * Get a single reminder by UUID (includes linked appointments).
 */
reminderRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      ok(res, await reminderRepository.findById(req.params.id as string));
    } catch (err) { handleError(res, err); }
  }
);

/**
 * POST /reminders
 * Create a new reminder record.
 *
 * Body:
 *   {
 *     "channel":     "WHATSAPP",
 *     "to":          "+15551234567",
 *     "sendMode":        "SCHEDULED",
 *     "sentAt":      "2026-04-01T10:00:00Z",
 *     "sendAt": "2026-03-31T10:00:00Z",  // required when sendMode=SCHEDULED
 *     "contentSid":  "HXabc..."               // optional Twilio template SID
 *   }
 */
reminderRouter.post(
  '/',
  validateBody(createReminderSchema),
  async (req: Request, res: Response) => {
    try {
      const reminder = await reminderRepository.create(req.body);
      logger.info({ reminderId: reminder.id }, 'Reminder created');
      ok(res, reminder, 201);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * PATCH /reminders/:id
 * Partially update a reminder (reschedule, update status, log errors, etc.).
 */
reminderRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateReminderSchema),
  async (req: Request, res: Response) => {
    try {
      const reminder = await reminderRepository.update(req.params.id as string, req.body);
      logger.info({ reminderId: reminder.id }, 'Reminder updated');
      ok(res, reminder);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * POST /reminders/:id/cancel
 * Cancel a pending reminder (sets status → CANCELLED).
 * Returns 409 if reminder is not in PENDING status.
 */
reminderRouter.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const reminder = await reminderRepository.cancel(req.params.id as string);
      logger.info({ reminderId: reminder.id }, 'Reminder cancelled');
      ok(res, reminder);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * DELETE /reminders/:id
 * Hard-delete a reminder record.
 * Prefer using POST /reminders/:id/cancel for audit-friendliness.
 */
reminderRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const reminder = await reminderRepository.delete(req.params.id as string);
      logger.info({ reminderId: reminder.id }, 'Reminder deleted');
      ok(res, { deleted: true, id: reminder.id });
    } catch (err) { handleError(res, err); }
  }
);
