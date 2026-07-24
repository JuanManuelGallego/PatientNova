import { Router, type Request, type Response } from 'express';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import { createMedicalRecordSchema, updateMedicalRecordSchema, listMedicalRecordsSchema, type ListMedicalRecordsQuery } from './medical-record.schemas.js';
import { medicalRecordService } from './medical-record.service.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { uuidParamSchema } from '../utils/validation/schemas.js';

export const medicalRecordRouter = Router();

/**
 * GET /medical-records
 * List medical records with optional filters and pagination.
 */
medicalRecordRouter.get<{}, any, any, ListMedicalRecordsQuery>(
  '/',
  validateQuery(listMedicalRecordsSchema),
  asyncHandler(async (req: Request<{}, any, any, ListMedicalRecordsQuery>, res: Response) => {
    ok(res, await medicalRecordService.findMany(req.query, req.user!.id));
  })
);

/**
 * GET /medical-records/:id
 * Get a single medical record by UUID (includes subsystem relations).
 */
medicalRecordRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await medicalRecordService.findById(req.params.id as string, req.user!.id));
  })
);

/**
 * POST /medical-records
 * Create a new medical record for a patient.
 */
medicalRecordRouter.post(
  '/',
  validateBody(createMedicalRecordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordService.create(req.body, req.user!.id);
    ok(res, rec, 201);
  })
);

/**
 * PATCH /medical-records/:id
 * Partially update a medical record.
 */
medicalRecordRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateMedicalRecordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordService.update(req.params.id as string, req.body, req.user!.id);
    ok(res, rec);
  })
);

/**
 * DELETE /medical-records/:id
 * Hard-delete a medical record.
 */
medicalRecordRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordService.delete(req.params.id as string, req.user!.id);
    ok(res, { deleted: true, id: rec.id });
  })
);

/**
 * PATCH /medical-records/:id/soft-delete
 * Soft-delete a medical record (sets isDeleted=true).
 */
medicalRecordRouter.patch(
  '/:id/soft-delete',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordService.softDelete(req.params.id as string, req.user!.id);
    ok(res, rec);
  })
);

/**
 * PATCH /medical-records/:id/restore
 * Restore a soft-deleted medical record (sets isDeleted=false).
 */
medicalRecordRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordService.restore(req.params.id as string, req.user!.id);
    ok(res, rec);
  })
);
