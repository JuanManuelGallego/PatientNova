import { Router, type Request, type Response } from 'express';
import {
  createAppointmentTypeSchema,
  updateAppointmentTypeSchema,
  listAppointmentTypesSchema,
  type ListAppointmentTypesQuery,
} from './appointment-type.schemas.js';
import { appointmentTypeService } from './appointment-type.service.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidParamSchema } from '../utils/schemas.js';

export const appointmentTypeRouter = Router();

appointmentTypeRouter.get<{}, any, any, ListAppointmentTypesQuery>(
  '/',
  validateQuery(listAppointmentTypesSchema),
  asyncHandler(async (req: Request<{}, any, any, ListAppointmentTypesQuery>, res: Response) => {
    ok(res, await appointmentTypeService.findMany(req.user!.id, req.query));
  })
);

appointmentTypeRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await appointmentTypeService.findById(req.params.id as string, req.user!.id));
  })
);

appointmentTypeRouter.post(
  '/',
  validateBody(createAppointmentTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const type = await appointmentTypeService.create(req.body, req.user!.id);
    ok(res, type, 201);
  })
);

appointmentTypeRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateAppointmentTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const type = await appointmentTypeService.update(req.params.id as string, req.body, req.user!.id);
    ok(res, type);
  })
);

appointmentTypeRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const type = await appointmentTypeService.delete(req.params.id as string, req.user!.id);
    ok(res, { deactivated: true, id: type.id });
  })
);

appointmentTypeRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const type = await appointmentTypeService.restore(req.params.id as string, req.user!.id);
    ok(res, type);
  })
);
