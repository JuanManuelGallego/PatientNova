import { Router, type Request, type Response } from 'express';
import {
  createLocationSchema,
  updateLocationSchema,
  uuidParamSchema,
} from './location.schemas.js';
import { locationRepository } from './location.repository.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import { logger } from '../utils/logger.js';
import { handleError, ok } from '../utils/apiUtils.js';

export const locationRouter = Router();

/**
 * GET /locations
 * List all appointment locations for the authenticated user.
 */
locationRouter.get('/', async (req: Request, res: Response) => {
  try {
    ok(res, await locationRepository.findMany(req.user!.id));
  } catch (err) { handleError(res, err); }
});

/**
 * GET /locations/:id
 * Get a single appointment location by UUID.
 */
locationRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      ok(res, await locationRepository.findById(req.params.id as string, req.user!.id));
    } catch (err) { handleError(res, err); }
  }
);

/**
 * POST /locations
 * Create a new appointment location.
 */
locationRouter.post(
  '/',
  validateBody(createLocationSchema),
  async (req: Request, res: Response) => {
    try {
      const location = await locationRepository.create(req.body, req.user!.id);
      logger.info({ locationId: location.id }, 'Appointment location created');
      ok(res, location, 201);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * PATCH /locations/:id
 * Partially update an appointment location.
 */
locationRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateLocationSchema),
  async (req: Request, res: Response) => {
    try {
      const location = await locationRepository.update(req.params.id as string, req.body, req.user!.id);
      logger.info({ locationId: location.id }, 'Appointment location updated');
      ok(res, location);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * DELETE /locations/:id
 * Soft-delete (deactivate) an appointment location.
 */
locationRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const location = await locationRepository.delete(req.params.id as string, req.user!.id);
      logger.info({ locationId: location.id }, 'Appointment location deactivated');
      ok(res, { deactivated: true, id: location.id });
    } catch (err) { handleError(res, err); }
  }
);
