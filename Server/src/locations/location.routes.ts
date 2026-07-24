import { Router, type Request, type Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import {
  createLocationSchema,
  updateLocationSchema,
  listLocationsSchema,
  type ListLocationsQuery,
} from './location.schemas.js';
import { locationService } from './location.service.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { uuidParamSchema } from '../utils/validation/schemas.js';

export const locationRouter = Router();

/**
 * GET /locations
 * List appointment locations with optional filters and pagination.
 */
locationRouter.get<ParamsDictionary, unknown, unknown, ListLocationsQuery & ParsedQs>(
  '/',
  validateQuery(listLocationsSchema),
  asyncHandler(async (req: Request<ParamsDictionary, unknown, unknown, ListLocationsQuery & ParsedQs>, res: Response) => {
    ok(res, await locationService.findMany(req.user!.id, req.query));
  })
);

/**
 * GET /locations/:id
 * Get a single location by UUID.
 */
locationRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await locationService.findById(req.params.id as string, req.user!.id));
  })
);

/**
 * POST /locations
 * Create a new appointment location.
 */
locationRouter.post(
  '/',
  validateBody(createLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const location = await locationService.create(req.body, req.user!.id);
    ok(res, location, 201);
  })
);

/**
 * PATCH /locations/:id
 * Partially update an appointment location.
 */
locationRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const location = await locationService.update(req.params.id as string, req.body, req.user!.id);
    ok(res, location);
  })
);

/**
 * DELETE /locations/:id
 * Soft-delete an appointment location (sets isActive=false).
 */
locationRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const location = await locationService.delete(req.params.id as string, req.user!.id);
    ok(res, { deleted: true, id: location.id });
  })
);

/**
 * PATCH /locations/:id/restore
 * Restore a soft-deleted appointment location (sets isActive=true).
 */
locationRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const location = await locationService.restore(req.params.id as string, req.user!.id);
    ok(res, location);
  })
);
