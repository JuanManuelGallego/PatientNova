import { Router, type Request, type Response } from 'express';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import { createMedicalRecordSchema, updateMedicalRecordSchema, listMedicalRecordsSchema, type ListMedicalRecordsQuery } from './medical-record.schemas.js';
import { medicalRecordService } from './medical-record.service.js';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uuidParamSchema } from '../utils/schemas.js';

export const medicalRecordRouter = Router();

medicalRecordRouter.get<{}, any, any, ListMedicalRecordsQuery>(
  '/',
  validateQuery(listMedicalRecordsSchema),
  asyncHandler(async (req: Request<{}, any, any, ListMedicalRecordsQuery>, res: Response) => {
    ok(res, await medicalRecordService.findMany(req.query, req.user!.id));
  })
);

medicalRecordRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await medicalRecordService.findById(req.params.id as string, req.user!.id));
  })
);

medicalRecordRouter.post(
  '/',
  validateBody(createMedicalRecordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordService.create(req.body, req.user!.id);
    ok(res, rec, 201);
  })
);

medicalRecordRouter.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateMedicalRecordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordService.update(req.params.id as string, req.body, req.user!.id);
    ok(res, rec);
  })
);

medicalRecordRouter.delete(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordService.delete(req.params.id as string, req.user!.id);
    ok(res, { deleted: true, id: rec.id });
  })
);

medicalRecordRouter.patch(
  '/:id/soft-delete',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordService.softDelete(req.params.id as string, req.user!.id);
    ok(res, rec);
  })
);

medicalRecordRouter.patch(
  '/:id/restore',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const rec = await medicalRecordService.restore(req.params.id as string, req.user!.id);
    ok(res, rec);
  })
);
