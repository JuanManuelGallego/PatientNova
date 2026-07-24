import { Router, type Request, type Response } from 'express';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  listAppointmentsSchema,
  appointmentStatsSchema,
  type ListAppointmentsQuery,
  type AppointmentStatsQuery,
} from './appointment.schemas.js';
import { appointmentService } from './appointment.service.js';
import { AppointmentStatus } from '../../generated/prisma/client.ts';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { ok } from '../utils/api/api-utils.js';
import { uuidParamSchema } from '../utils/validation/schemas.js';

export const appointmentRouter = Router();

appointmentRouter.get<{}, any, any, ListAppointmentsQuery>(
  '/',
  validateQuery(listAppointmentsSchema),
  asyncHandler(async (req: Request<{}, any, any, ListAppointmentsQuery>, res: Response) => {
    ok(res, await appointmentService.findMany(req.query, req.user!.id, req.user!.timezone));
  }),
);

appointmentRouter.get<{}, any, any, AppointmentStatsQuery>(
  '/stats',
  validateQuery(appointmentStatsSchema),
  asyncHandler(async (req: Request<{}, any, any, AppointmentStatsQuery>, res: Response) => {
    ok(res, await appointmentService.getStats(req.query, req.user!.id, req.user!.timezone));
  }),
);

appointmentRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await appointmentService.findById(req.params.id as string, req.user!.id));
  }),
);

appointmentRouter.post(
  '/',
  validateBody(createAppointmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.create(req.body, req.user!.id);
    ok(res, appt, 201);
  }),
);

appointmentRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateAppointmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.update(req.params.id as string, req.body, req.user!.id);
    ok(res, appt);
  }),
);

appointmentRouter.post(
  '/:id/pay',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.markPaid(req.params.id as string, req.user!.id);
    ok(res, appt);
  }),
);

appointmentRouter.post(
  '/:id/confirm',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.setStatus(req.params.id as string, req.user!.id, AppointmentStatus.CONFIRMED);
    ok(res, appt);
  }),
);

appointmentRouter.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.setStatus(req.params.id as string, req.user!.id, AppointmentStatus.CANCELLED);
    ok(res, appt);
  }),
);

appointmentRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await appointmentService.delete(req.params.id as string, req.user!.id);
    ok(res, { deleted: true, id: result.id });
  }),
);

appointmentRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.restore(req.params.id as string, req.user!.id);
    ok(res, appt);
  }),
);
