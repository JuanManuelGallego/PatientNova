import { Router, type Request, type Response } from 'express';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import { createMedicalRecordSchema, updateMedicalRecordSchema, listMedicalRecordsSchema, type ListMedicalRecordsQuery } from './medical-record.schemas.js';
import { medicalRecordRepository } from './medical-record.repository.js';
import { ok } from '../utils/apiUtils.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidParamSchema } from '../utils/schemas.js';

export const medicalRecordRouter = Router();

medicalRecordRouter.get<{}, any, any, ListMedicalRecordsQuery>(
  '/',
  validateQuery(listMedicalRecordsSchema),
  asyncHandler(async (req: Request<{}, any, any, ListMedicalRecordsQuery>, res: Response) => {
    ok(res, await medicalRecordRepository.findMany(req.query, req.user!.id));
  })
);

medicalRecordRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await medicalRecordRepository.findById(req.params.id as string, req.user!.id));
  })
);

medicalRecordRouter.post(
  '/',
  validateBody(createMedicalRecordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordRepository.create(req.body, req.user!.id);
    logger.info({ medicalRecordId: rec.id }, 'Medical record created');
    ok(res, rec, 201);
  })
);

medicalRecordRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateMedicalRecordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordRepository.update(req.params.id as string, req.body, req.user!.id);
    logger.info({ medicalRecordId: rec.id }, 'Medical record updated');
    ok(res, rec);
  })
);

medicalRecordRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordRepository.delete(req.params.id as string, req.user!.id);
    logger.info({ medicalRecordId: rec.id }, 'Medical record deleted');
    ok(res, { deleted: true, id: rec.id });
  })
);
