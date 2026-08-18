import { Router, type Request, type Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import {
  createBlockedTimeSchema,
  updateBlockedTimeSchema,
  listBlockedTimeSchema,
  type ListBlockedTimeQuery,
} from './blocked-time.schemas.js';
import { blockedTimeService } from './blocked-time.service.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { uuidParamSchema } from '../utils/validation/schemas.js';

export const blockedTimeRouter = Router();

/**
 * GET /blocked-time
 * List the current user's blocked time slots with optional filters and pagination.
 */
blockedTimeRouter.get<ParamsDictionary, unknown, unknown, ListBlockedTimeQuery & ParsedQs>(
  '/',
  validateQuery(listBlockedTimeSchema),
  asyncHandler(async (req: Request<ParamsDictionary, unknown, unknown, ListBlockedTimeQuery & ParsedQs>, res: Response) => {
    ok(res, await blockedTimeService.findMany(req.user!.id, req.query));
  })
);

/**
 * GET /blocked-time/:id
 * Get a single blocked time slot by UUID.
 */
blockedTimeRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await blockedTimeService.findById(req.params.id as string, req.user!.id));
  })
);

/**
 * POST /blocked-time
 * Create a new blocked time slot.
 */
blockedTimeRouter.post(
  '/',
  validateBody(createBlockedTimeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const blockedTime = await blockedTimeService.create(req.body, req.user!.id);
    ok(res, blockedTime, 201);
  })
);

/**
 * PATCH /blocked-time/:id
 * Partially update a blocked time slot.
 */
blockedTimeRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateBlockedTimeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const blockedTime = await blockedTimeService.update(req.params.id as string, req.body, req.user!.id);
    ok(res, blockedTime);
  })
);

/**
 * DELETE /blocked-time/:id
 * Soft-delete a blocked time slot (sets isDeleted=true).
 */
blockedTimeRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const blockedTime = await blockedTimeService.delete(req.params.id as string, req.user!.id);
    ok(res, { deleted: true, id: blockedTime.id });
  })
);

/**
 * PATCH /blocked-time/:id/restore
 * Restore a soft-deleted blocked time slot (sets isDeleted=false).
 */
blockedTimeRouter.post(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const blockedTime = await blockedTimeService.restore(req.params.id as string, req.user!.id);
    ok(res, blockedTime);
  })
);
