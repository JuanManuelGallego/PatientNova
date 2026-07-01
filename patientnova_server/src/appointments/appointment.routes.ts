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
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { logger } from '../utils/logger.js';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidParamSchema } from '../utils/schemas.js';
import { AppointmentStatus } from '../../generated/prisma/enums.js';

export const appointmentRouter = Router();

/**
 * GET /appointments
 * List appointments with optional filters and pagination.
 * Response includes joined patient and reminder objects.
 */
appointmentRouter.get<{}, any, any, ListAppointmentsQuery>(
  '/',
  validateQuery(listAppointmentsSchema),
  asyncHandler(async (req: Request<{}, any, any, ListAppointmentsQuery>, res: Response) => {
    ok(res, await appointmentService.findMany(req.query, req.user!.id, req.user!.timezone));
  })
);

/**
 * GET /appointments/stats
 * Aggregate statistics: totals by status, revenue (paid vs unpaid).
 * Optional filters: patientId, dateFrom, dateTo.
 */
appointmentRouter.get<{}, any, any, AppointmentStatsQuery>(
  '/stats',
  validateQuery(appointmentStatsSchema),
  asyncHandler(async (req: Request<{}, any, any, AppointmentStatsQuery>, res: Response) => {
    ok(res, await appointmentService.getStats(req.query, req.user!.id, req.user!.timezone));
  })
);

/**
 * GET /appointments/:id
 * Get a single appointment by UUID (includes patient and reminder details).
 */
appointmentRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await appointmentService.findById(req.params.id as string, req.user!.id));
  })
);

/**
 * POST /appointments
 * Create a new appointment.
 */
appointmentRouter.post(
  '/',
  validateBody(createAppointmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.create(req.body, req.user!.id);
    logger.info({ appointmentId: appt.id, patientId: appt.patientId }, 'Appointment created');
    ok(res, appt, 201);
  })
);

/**
 * PATCH /appointments/:id
 * Partially update an appointment — only send the fields you want to change.
 */
appointmentRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateAppointmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.update(req.params.id as string, req.body, req.user!.id);
    logger.info({ appointmentId: appt.id }, 'Appointment updated');
    ok(res, appt);
  })
);

/**
 * POST /appointments/:id/pay
 * Convenience endpoint — marks the appointment as paid (paid = true).
 */
appointmentRouter.post(
  '/:id/pay',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.markPaid(req.params.id as string, req.user!.id);
    logger.info({ appointmentId: appt.id }, 'Appointment marked as paid');
    ok(res, appt);
  })
);

/**
 * POST /appointments/:id/confirm
 * Convenience endpoint — marks the appointment as confirmed (status = "CONFIRMED").
 */
appointmentRouter.post(
  '/:id/confirm',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.setStatus(req.params.id as string, req.user!.id, AppointmentStatus.CONFIRMED);
    logger.info({ appointmentId: appt.id }, 'Appointment marked as confirmed');
    ok(res, appt);
  })
);

/**
 * POST /appointments/:id/cancel
 * Convenience endpoint — marks the appointment as cancelled (status = "CANCELLED").
 */
appointmentRouter.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.setStatus(req.params.id as string, req.user!.id, AppointmentStatus.CANCELLED);
    logger.info({ appointmentId: appt.id }, 'Appointment marked as cancelled');
    ok(res, appt);
  })
);

/**
 * DELETE /appointments/:id
 * Hard-delete an appointment.
 * Consider using PATCH { status: "CANCELLED" } to preserve history.
 */
appointmentRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await appointmentService.delete(req.params.id as string, req.user!.id);
    logger.info({ appointmentId: result.id }, 'Appointment deleted');
    ok(res, { deleted: true, id: result.id });
  })
);

/**
 * PATCH /appointments/:id/restore
 * Restore a soft-deleted appointment (sets isDeleted=false, deletedAt=null).
 */
appointmentRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const appt = await appointmentService.restore(req.params.id as string, req.user!.id);
    logger.info({ appointmentId: appt.id }, 'Appointment restored');
    ok(res, appt);
  })
);
