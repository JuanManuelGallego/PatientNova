import { Router, type Request, type Response } from 'express';
import {
  createReminderSchema,
  updateReminderSchema,
  listRemindersSchema,
  reminderStatsSchema,
  uuidParamSchema,
  type ListRemindersQuery,
  type ReminderStatsQuery,
} from './reminder.schemas.js';
import { reminderRepository } from './reminder.repository.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { logger } from '../utils/logger.js';
import { handleError, ok } from '../utils/apiUtils.js';

export const reminderRouter = Router();

/**
 * GET /reminders
 * List reminders with optional filters and pagination.
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
 * GET /reminders/stats
 * Aggregate statistics: totals by status and channel.
 * Optional filters: patientId, dateFrom, dateTo.
 */
reminderRouter.get<{}, any, any, ReminderStatsQuery>(
  '/stats',
  validateQuery(reminderStatsSchema),
  async (req: Request<{}, any, any, ReminderStatsQuery>, res: Response) => {
    try {
      ok(res, await reminderRepository.getStats(req.query));
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
