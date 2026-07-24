import { Router, type Request, type Response } from 'express';
import {
  createAppointmentTypeSchema,
  updateAppointmentTypeSchema,
  listAppointmentTypesSchema,
  type ListAppointmentTypesQuery,
} from './appointment-type.schemas.js';
import { appointmentTypeService } from './appointment-type.service.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { uuidParamSchema } from '../utils/validation/schemas.js';

export const appointmentTypeRouter = Router();

/**
 * GET /appointment-types
 * List appointment types with optional filters and pagination.
 */
appointmentTypeRouter.get<{}, any, any, ListAppointmentTypesQuery>(
  '/',
  validateQuery(listAppointmentTypesSchema),
  asyncHandler(async (req: Request<{}, any, any, ListAppointmentTypesQuery>, res: Response) => {
    ok(res, await appointmentTypeService.findMany(req.user!.id, req.query));
  })
);

/**
 * GET /appointment-types/:id
 * Get a single appointment type by UUID.
 */
appointmentTypeRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await appointmentTypeService.findById(req.params.id as string, req.user!.id));
  })
);

/**
 * POST /appointment-types
 * Create a new appointment type.
 */
appointmentTypeRouter.post(
  '/',
  validateBody(createAppointmentTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const type = await appointmentTypeService.create(req.body, req.user!.id);
    ok(res, type, 201);
  })
);

/**
 * PATCH /appointment-types/:id
 * Partially update an appointment type.
 */
appointmentTypeRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateAppointmentTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const type = await appointmentTypeService.update(req.params.id as string, req.body, req.user!.id);
    ok(res, type);
  })
);

/**
 * DELETE /appointment-types/:id
 * Soft-delete an appointment type (sets isActive=false).
 */
appointmentTypeRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const type = await appointmentTypeService.delete(req.params.id as string, req.user!.id);
    ok(res, { deactivated: true, id: type.id });
  })
);

/**
 * PATCH /appointment-types/:id/restore
 * Restore a soft-deleted appointment type (sets isActive=true).
 */
appointmentTypeRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const type = await appointmentTypeService.restore(req.params.id as string, req.user!.id);
    ok(res, type);
  })
);
