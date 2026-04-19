import { Router, type Request, type Response } from 'express';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import { uuidParamSchema, createMedicalRecordSchema, updateMedicalRecordSchema, listMedicalRecordsSchema, type ListMedicalRecordsQuery } from './medical-record.schemas.js';
import { medicalRecordRepository } from './medical-record.repository.js';
import { handleError, ok } from '../utils/apiUtils.js';
import { logger } from '../utils/logger.js';

export const medicalRecordRouter = Router();

medicalRecordRouter.get<{}, any, any, ListMedicalRecordsQuery>(
  '/',
  validateQuery(listMedicalRecordsSchema),
  async (req: Request<{}, any, any, ListMedicalRecordsQuery>, res: Response) => {
    try {
      const result = await medicalRecordRepository.findMany(req.query, req.user!.id);
      ok(res, result);
    } catch (err) {
      handleError(res, err);
    }
  }
);

medicalRecordRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const rec = await medicalRecordRepository.findById(req.params.id as string, req.user!.id);
      ok(res, rec);
    } catch (err) {
      handleError(res, err);
    }
  }
);

medicalRecordRouter.post(
  '/',
  validateBody(createMedicalRecordSchema),
  async (req: Request, res: Response) => {
    try {
      const rec = await medicalRecordRepository.create(req.body, req.user!.id);
      logger.info({ medicalRecordId: rec.id }, 'Medical record created');
      ok(res, rec, 201);
    } catch (err) {
      handleError(res, err);
    }
  }
);

medicalRecordRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateMedicalRecordSchema),
  async (req: Request, res: Response) => {
    try {
      const rec = await medicalRecordRepository.update(req.params.id as string, req.body, req.user!.id);
      logger.info({ medicalRecordId: rec.id }, 'Medical record updated');
      ok(res, rec);
    } catch (err) {
      handleError(res, err);
    }
  }
);

medicalRecordRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  async (req: Request, res: Response) => {
    try {
      const rec = await medicalRecordRepository.delete(req.params.id as string, req.user!.id);
      logger.info({ medicalRecordId: rec.id }, 'Medical record deleted');
      ok(res, { deleted: true, id: rec.id });
    } catch (err) {
      handleError(res, err);
    }
  }
);
