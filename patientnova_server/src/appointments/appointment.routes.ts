import { Router, type Request, type Response } from 'express';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  listAppointmentsSchema,
  appointmentStatsSchema,
  uuidParamSchema,
  type ListAppointmentsQuery,
  type AppointmentStatsQuery,
} from './appointment.schemas.js';
import {
  appointmentRepository,
} from './appointment.repository.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { logger } from '../utils/logger.js';
import { handleError, ok } from '../utils/apiUtils.js';

export const appointmentRouter = Router();

/**
 * GET /appointments
 * List appointments with optional filters and pagination.
 * Response includes joined patient and reminder objects.
 */
appointmentRouter.get<{}, any, any, ListAppointmentsQuery>(
  '/',
  validateQuery(listAppointmentsSchema),
  async (req: Request<{}, any, any, ListAppointmentsQuery>, res: Response) => {
    try {
      const result = await appointmentRepository.findMany(req.query, req.user!.id, req.user!.timezone);
      ok(res, result);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * GET /appointments/stats
 * Aggregate statistics: totals by status, revenue (paid vs unpaid).
 * Optional filters: patientId, dateFrom, dateTo.
 */
appointmentRouter.get<{}, any, any, AppointmentStatsQuery>(
  '/stats',
  validateQuery(appointmentStatsSchema),
  async (req: Request<{}, any, any, AppointmentStatsQuery>, res: Response) => {
    try {
      ok(res, await appointmentRepository.getStats(req.query, req.user!.id, req.user!.timezone));
    } catch (err) { handleError(res, err); }
  }
);

/**
 * GET /appointments/:id
 * Get a single appointment by UUID (includes patient and reminder details).
 */
appointmentRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      ok(res, await appointmentRepository.findById(req.params.id as string, req.user!.id));
    } catch (err) { handleError(res, err); }
  }
);

/**
 * POST /appointments
 * Create a new appointment.
 */
appointmentRouter.post(
  '/',
  validateBody(createAppointmentSchema),
  async (req: Request, res: Response) => {
    try {
      const appt = await appointmentRepository.create(req.body, req.user!.id);
      logger.info({ appointmentId: appt.id, patientId: appt.patientId }, 'Appointment created');
      ok(res, appt, 201);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * PATCH /appointments/:id
 * Partially update an appointment — only send the fields you want to change.
 */
appointmentRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateAppointmentSchema),
  async (req: Request, res: Response) => {
    try {
      const appt = await appointmentRepository.update(req.params.id as string, req.body, req.user!.id);
      logger.info({ appointmentId: appt.id }, 'Appointment updated');
      ok(res, appt);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * POST /appointments/:id/pay
 * Convenience endpoint — marks the appointment as paid (paid = true).
 */
appointmentRouter.post(
  '/:id/pay',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const appt = await appointmentRepository.markPaid(req.params.id as string, req.user!.id);
      logger.info({ appointmentId: appt.id }, 'Appointment marked as paid');
      ok(res, appt);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * POST /appointments/:id/confirm
 * Convenience endpoint — marks the appointment as confirmed (status = "CONFIRMED").
 */
appointmentRouter.post(
  '/:id/confirm',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const appt = await appointmentRepository.markConfirmed(req.params.id as string, req.user!.id);
      logger.info({ appointmentId: appt.id }, 'Appointment marked as confirmed');
      ok(res, appt);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * POST /appointments/:id/cancel
 * Convenience endpoint — marks the appointment as cancelled (status = "CANCELLED").
 */
appointmentRouter.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const appt = await appointmentRepository.markCancelled(req.params.id as string, req.user!.id);
      logger.info({ appointmentId: appt.id }, 'Appointment marked as cancelled');
      ok(res, appt);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * DELETE /appointments/:id
 * Hard-delete an appointment.
 * Consider using PATCH { status: "CANCELLED" } to preserve history.
 */
appointmentRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const appt = await appointmentRepository.delete(req.params.id as string, req.user!.id);
      logger.info({ appointmentId: appt.id }, 'Appointment deleted');
      ok(res, { deleted: true, id: appt.id });
    } catch (err) { handleError(res, err); }
  }
);
