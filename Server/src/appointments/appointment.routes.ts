import { Router } from 'express';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  listAppointmentsSchema,
  appointmentStatsSchema,
  type ListAppointmentsQuery,
  type AppointmentStatsQuery,
} from './appointment.schemas.js';
import { appointmentController as controller } from './appointment.controller.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidParamSchema } from '../utils/schemas.js';

export const appointmentRouter = Router();

appointmentRouter.get<{}, any, any, ListAppointmentsQuery>(
  '/',
  validateQuery(listAppointmentsSchema),
  asyncHandler(controller.list),
);

appointmentRouter.get<{}, any, any, AppointmentStatsQuery>(
  '/stats',
  validateQuery(appointmentStatsSchema),
  asyncHandler(controller.stats),
);

appointmentRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(controller.get),
);

appointmentRouter.post(
  '/',
  validateBody(createAppointmentSchema),
  asyncHandler(controller.create),
);

appointmentRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateAppointmentSchema),
  asyncHandler(controller.update),
);

appointmentRouter.post(
  '/:id/pay',
  validateParams(uuidParamSchema),
  asyncHandler(controller.markPaid),
);

appointmentRouter.post(
  '/:id/confirm',
  validateParams(uuidParamSchema),
  asyncHandler(controller.confirm),
);

appointmentRouter.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  asyncHandler(controller.cancel),
);

appointmentRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(controller.remove),
);

appointmentRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(controller.restore),
);
