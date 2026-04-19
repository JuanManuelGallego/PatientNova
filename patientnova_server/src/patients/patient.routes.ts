import { Router, type Request, type Response } from 'express';
import {
  createPatientSchema,
  updatePatientSchema,
  listPatientsSchema,
  type ListPatientsQuery,
} from './patient.schemas.js';
import {
  patientRepository,
} from './patient.repository.js';
import { logger } from '../utils/logger.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidParamSchema } from '../utils/schemas.js';

export const patientRouter = Router();

/**
 * GET /patients
 * List all patients with optional filtering and pagination.
 * Response: { data: Patient[], total, page, pageSize, totalPages }
 */
patientRouter.get<{}, any, any, ListPatientsQuery>(
  '/',
  validateQuery(listPatientsSchema),
  asyncHandler(async (req: Request<{}, any, any, ListPatientsQuery>, res: Response) => {
    ok(res, await patientRepository.findMany(req.query, req.user!.id));
  })
);

/**
 * GET /patients/stats
 * Get total patient count and a breakdown by status.
 * Response: { total: number, byStatus: Record<PatientStatus, number> }
 */
patientRouter.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientRepository.getStats(req.user!.id));
  })
);

/**
 * GET /patients/:id
 * Get a single patient by UUID.
 */
patientRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientRepository.findByIdWithRelations(req.params.id as string, req.user!.id));
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
    const patient = await patientRepository.create(req.body, req.user!.id);
    logger.info({ patientId: patient.id }, 'Patient created');
    ok(res, patient, 201);
  })
);

/**
 * PATCH /patients/:id
 * Partially update a patient — only send the fields you want to change.
 */
patientRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updatePatientSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientRepository.update(req.params.id as string, req.body, req.user!.id);
    logger.info({ patientId: patient.id }, 'Patient updated');
    ok(res, patient);
  })
);

/**
 * DELETE /patients/:id
 * Permanently delete a patient record.
 * Consider using PATCH /patients/:id { status: "ARCHIVED" } for soft deletes.
 */
patientRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientRepository.delete(req.params.id as string, req.user!.id);
    logger.info({ patientId: patient.id }, 'Patient deleted');
    ok(res, { deleted: true, id: patient.id });
  })
);
