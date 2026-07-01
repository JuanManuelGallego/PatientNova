import { Router, type Request, type Response } from 'express';
import {
  createLocationSchema,
  updateLocationSchema,
  listLocationsSchema,
  type ListLocationsQuery,
} from './location.schemas.js';
import { locationService } from './location.service.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { logger } from '../utils/logger.js';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidParamSchema } from '../utils/schemas.js';

export const locationRouter = Router();

locationRouter.get<{}, any, any, ListLocationsQuery>(
  '/',
  validateQuery(listLocationsSchema),
  asyncHandler(async (req: Request<{}, any, any, ListLocationsQuery>, res: Response) => {
    ok(res, await locationService.findMany(req.user!.id, req.query));
  })
);

locationRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await locationService.findById(req.params.id as string, req.user!.id));
  })
);

locationRouter.post(
  '/',
  validateBody(createLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const location = await locationService.create(req.body, req.user!.id);
    logger.info({ locationId: location.id }, 'Appointment location created');
    ok(res, location, 201);
  })
);

locationRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const location = await locationService.update(req.params.id as string, req.body, req.user!.id);
    logger.info({ locationId: location.id }, 'Appointment location updated');
    ok(res, location);
  })
);

locationRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const location = await locationService.delete(req.params.id as string, req.user!.id);
    logger.info({ locationId: location.id }, 'Appointment location deleted');
    ok(res, { deleted: true, id: location.id });
  })
);

locationRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const location = await locationService.restore(req.params.id as string, req.user!.id);
    logger.info({ locationId: location.id }, 'Appointment location restored');
    ok(res, location);
  })
);
