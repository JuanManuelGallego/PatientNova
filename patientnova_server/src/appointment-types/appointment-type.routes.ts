import { Router, type Request, type Response } from 'express';
import {
  createAppointmentTypeSchema,
  updateAppointmentTypeSchema,
} from './appointment-type.schemas.js';
import { appointmentTypeRepository } from './appointment-type.repository.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import { logger } from '../utils/logger.js';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidParamSchema } from '../utils/schemas.js';

export const appointmentTypeRouter = Router();

/**
 * GET /appointment-types
 * List all appointment types for the authenticated user.
 */
appointmentTypeRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  ok(res, await appointmentTypeRepository.findMany(req.user!.id));
}));

/**
 * GET /appointment-types/:id
 * Get a single appointment type by UUID.
 */
appointmentTypeRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await appointmentTypeRepository.findById(req.params.id as string, req.user!.id));
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
    const type = await appointmentTypeRepository.create(req.body, req.user!.id);
    logger.info({ typeId: type.id }, 'Appointment type created');
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
    const type = await appointmentTypeRepository.update(req.params.id as string, req.body, req.user!.id);
    logger.info({ typeId: type.id }, 'Appointment type updated');
    ok(res, type);
  })
);

/**
 * DELETE /appointment-types/:id
 * Soft-delete (deactivate) an appointment type.
 */
appointmentTypeRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const type = await appointmentTypeRepository.delete(req.params.id as string, req.user!.id);
    logger.info({ typeId: type.id }, 'Appointment type deactivated');
    ok(res, { deactivated: true, id: type.id });
  })
);
