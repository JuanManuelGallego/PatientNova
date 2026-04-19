import { Router, type Request, type Response } from 'express';
import {
  createReminderSchema,
  updateReminderSchema,
  listRemindersSchema,
  reminderStatsSchema,
  type ListRemindersQuery,
  type ReminderStatsQuery,
} from './reminder.schemas.js';
import { reminderRepository } from './reminder.repository.js';
import { reminderService } from './reminder.service.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { logger } from '../utils/logger.js';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidParamSchema } from '../utils/schemas.js';

export const reminderRouter = Router();

/**
 * GET /reminders
 * List reminders with optional filters and pagination.
 */
reminderRouter.get<{}, any, any, ListRemindersQuery>(
  '/',
  validateQuery(listRemindersSchema),
  asyncHandler(async (req: Request<{}, any, any, ListRemindersQuery>, res: Response) => {
    ok(res, await reminderService.findMany(req.query, req.user!.id));
  })
);

/**
 * GET /reminders/stats
 * Aggregate statistics: totals by status and channel.
 * Optional filters: patientId, dateFrom, dateTo.
 */
reminderRouter.get<{}, any, any, ReminderStatsQuery>(
  '/stats',
  validateQuery(reminderStatsSchema),
  asyncHandler(async (req: Request<{}, any, any, ReminderStatsQuery>, res: Response) => {
    ok(res, await reminderService.getStats(req.query, req.user!.id));
  })
);

/**
 * GET /reminders/:id
 * Get a single reminder by UUID (includes linked appointments).
 */
reminderRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await reminderService.findById(req.params.id as string, req.user!.id));
  })
);

/**
 * POST /reminders
 * Create a new reminder record.
 */
reminderRouter.post(
  '/',
  validateBody(createReminderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const reminder = await reminderService.create(req.body, req.user!.id);
    logger.info({ reminderId: reminder.id }, 'Reminder created');
    ok(res, reminder, 201);
  })
);

/**
 * PATCH /reminders/:id
 * Partially update a reminder (reschedule, update status, log errors, etc.).
 */
reminderRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateReminderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const reminder = await reminderService.update(req.params.id as string, req.body, req.user!.id);
    logger.info({ reminderId: reminder.id }, 'Reminder updated');
    ok(res, reminder);
  })
);

/**
 * POST /reminders/:id/cancel
 * Cancel a pending reminder (sets status → CANCELLED).
 * Returns 409 if reminder is not in PENDING status.
 */
reminderRouter.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const reminder = await reminderService.cancel(req.params.id as string, req.user!.id);
    logger.info({ reminderId: reminder.id }, 'Reminder cancelled');
    ok(res, reminder);
  })
);

/**
 * DELETE /reminders/:id
 * Hard-delete a reminder record.
 * Prefer using POST /reminders/:id/cancel for audit-friendliness.
 */
reminderRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const reminder = await reminderService.delete(req.params.id as string, req.user!.id);
    logger.info({ reminderId: reminder.id }, 'Reminder deleted');
    ok(res, { deleted: true, id: reminder.id });
  })
);
