import { Router, type Request, type Response } from 'express';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  listAppointmentsSchema,
  uuidParamSchema,
  type ListAppointmentsQuery,
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
 *
 * Query params:
 *   patientId — filter by patient UUID
 *   status    — SCHEDULED | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW
 *   date      — exact date filter   (YYYY-MM-DD)
 *   dateFrom  — range start         (YYYY-MM-DD)
 *   dateTo    — range end           (YYYY-MM-DD)
 *   payed     — true | false
 *   page      — default 1
 *   pageSize  — default 20, max 100
 *   orderBy   — date | createdAt | status | price  (default: date)
 *   order     — asc | desc  (default: asc)
 *
 * Response includes joined patient and reminder objects.
 */
appointmentRouter.get<{}, any, any, ListAppointmentsQuery>(
  '/',
  validateQuery(listAppointmentsSchema),
  async (req: Request<{}, any, any, ListAppointmentsQuery>, res: Response) => {
    try {
      const result = await appointmentRepository.findMany(req.query);
      ok(res, result);
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
      ok(res, await appointmentRepository.findById(req.params.id as string));
    } catch (err) { handleError(res, err); }
  }
);

/**
 * POST /appointments
 * Create a new appointment.
 *
 * Body:
 *   {
 *     "patientId":  "uuid",
 *     "date":       "2026-04-10",
 *     "time":       "09:00",
 *     "type":       "Revisión General",
 *     "location":   "Consultorio 3, Clínica Central",
 *     "price":      "150.00",
 *     "duration":   "30 min",
 *     "payed":      false,
 *     "status":     "SCHEDULED",       // optional, default: SCHEDULED
 *     "reminderId": "uuid",            // optional
 *     "meetingUrl": "https://..."      // optional
 *   }
 */
appointmentRouter.post(
  '/',
  validateBody(createAppointmentSchema),
  async (req: Request, res: Response) => {
    try {
      const appt = await appointmentRepository.create(req.body);
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
      const appt = await appointmentRepository.update(req.params.id as string, req.body);
      logger.info({ appointmentId: appt.id }, 'Appointment updated');
      ok(res, appt);
    } catch (err) { handleError(res, err); }
  }
);

/**
 * POST /appointments/:id/pay
 * Convenience endpoint — marks the appointment as paid (payed = true).
 */
appointmentRouter.post(
  '/:id/pay',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const appt = await appointmentRepository.markPaid(req.params.id as string);
      logger.info({ appointmentId: appt.id }, 'Appointment marked as paid');
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
      const appt = await appointmentRepository.delete(req.params.id as string);
      logger.info({ appointmentId: appt.id }, 'Appointment deleted');
      ok(res, { deleted: true, id: appt.id });
    } catch (err) { handleError(res, err); }
  }
);
