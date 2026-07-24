import { Router, type Request, type Response } from 'express';
import {
  createPatientSchema,
  updatePatientSchema,
  listPatientsSchema,
  patientStatsSchema,
  type ListPatientsQuery,
  type PatientStatsQuery,
} from './patient.schemas.js';
import { patientService } from './patient.service.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { uuidParamSchema } from '../utils/validation/schemas.js';

export const patientRouter = Router();

/**
 * GET /patients
 * List patients with optional filters and pagination.
 */
patientRouter.get<{}, any, any, ListPatientsQuery>(
  '/',
  validateQuery(listPatientsSchema),
  asyncHandler(async (req: Request<{}, any, any, ListPatientsQuery>, res: Response) => {
    ok(res, await patientService.findMany(req.query, req.user!.id));
  })
);

/**
 * GET /patients/stats
 * Aggregate statistics: totals by status.
 * Optional filters: dateFrom, dateTo.
 */
patientRouter.get<{}, any, any, PatientStatsQuery>(
  '/stats',
  validateQuery(patientStatsSchema),
  asyncHandler(async (req: Request<{}, any, any, PatientStatsQuery>, res: Response) => {
    ok(res, await patientService.getStats(req.user!.id, req.query));
  })
);

/**
 * GET /patients/:id
 * Get a single patient by UUID (includes appointments and reminders).
 */
patientRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientService.findByIdWithRelations(req.params.id as string, req.user!.id));
  })
);

/**
 * POST /patients
 * Create a new patient.
 */
patientRouter.post(
  '/',
  validateBody(createPatientSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientService.create(req.body, req.user!.id);
    ok(res, patient, 201);
  })
);

/**
 * PATCH /patients/:id
 * Partially update a patient.
 */
patientRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updatePatientSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientService.update(req.params.id as string, req.body, req.user!.id);
    ok(res, patient);
  })
);

/**
 * DELETE /patients/:id
 * Soft-delete a patient (sets isDeleted=true).
 */
patientRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientService.delete(req.params.id as string, req.user!.id);
    ok(res, { deleted: true, id: patient.id });
  })
);

/**
 * PATCH /patients/:id/restore
 * Restore a soft-deleted patient (sets isDeleted=false).
 */
patientRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientService.restore(req.params.id as string, req.user!.id);
    ok(res, patient);
  })
);
