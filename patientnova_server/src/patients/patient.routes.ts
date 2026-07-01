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
import { logger } from '../utils/logger.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.js';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidParamSchema } from '../utils/schemas.js';

export const patientRouter = Router();

patientRouter.get<{}, any, any, ListPatientsQuery>(
  '/',
  validateQuery(listPatientsSchema),
  asyncHandler(async (req: Request<{}, any, any, ListPatientsQuery>, res: Response) => {
    ok(res, await patientService.findMany(req.query, req.user!.id));
  })
);

patientRouter.get<{}, any, any, PatientStatsQuery>(
  '/stats',
  validateQuery(patientStatsSchema),
  asyncHandler(async (req: Request<{}, any, any, PatientStatsQuery>, res: Response) => {
    ok(res, await patientService.getStats(req.user!.id, req.query));
  })
);

patientRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientService.findByIdWithRelations(req.params.id as string, req.user!.id));
  })
);

patientRouter.post(
  '/',
  validateBody(createPatientSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientService.create(req.body, req.user!.id);
    logger.info({ patientId: patient.id }, 'Patient created');
    ok(res, patient, 201);
  })
);

patientRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updatePatientSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientService.update(req.params.id as string, req.body, req.user!.id);
    logger.info({ patientId: patient.id }, 'Patient updated');
    ok(res, patient);
  })
);

patientRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientService.delete(req.params.id as string, req.user!.id);
    logger.info({ patientId: patient.id }, 'Patient deleted');
    ok(res, { deleted: true, id: patient.id });
  })
);

patientRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientService.restore(req.params.id as string, req.user!.id);
    logger.info({ patientId: patient.id }, 'Patient restored');
    ok(res, patient);
  })
);
