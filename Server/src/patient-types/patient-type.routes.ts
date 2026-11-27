import { Router, type Request, type Response } from 'express';
import { validateBody, validateParams } from '../middlewares/validate.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import {
  consentVersionParamsSchema,
  createConsentVersionSchema,
  createPatientTypeSchema,
  patientTypeParamsSchema,
  updatePatientTypeSchema,
} from './patient-type.schemas.js';
import { patientTypeService } from './patient-type.service.js';
import { sendConsentDocument } from '../consent-documents/send-consent-document.js';

export const patientTypeRouter = Router();

patientTypeRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.list(req.user!.id));
  }),
);

patientTypeRouter.post(
  '/',
  validateBody(createPatientTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.create(req.user!.id, req.body), 201);
  }),
);

patientTypeRouter.patch(
  '/:id',
  validateParams(patientTypeParamsSchema),
  validateBody(updatePatientTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.update(req.user!.id, req.params.id as string, req.body));
  }),
);

patientTypeRouter.post(
  '/:id/default',
  validateParams(patientTypeParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.setDefault(req.user!.id, req.params.id as string));
  }),
);

patientTypeRouter.delete(
  '/:id',
  validateParams(patientTypeParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.delete(req.user!.id, req.params.id as string));
  }),
);

patientTypeRouter.get(
  '/:id/consent-versions',
  validateParams(patientTypeParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.listVersions(req.user!.id, req.params.id as string));
  }),
);

patientTypeRouter.post(
  '/:id/consent-versions',
  validateParams(patientTypeParamsSchema),
  validateBody(createConsentVersionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.addVersion(req.user!.id, req.params.id as string, req.body), 201);
  }),
);

patientTypeRouter.get(
  '/:id/consent-versions/:versionId/download',
  validateParams(consentVersionParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const version = await patientTypeService.getVersionContent(
      req.user!.id,
      req.params.id as string,
      req.params.versionId as string,
    );
    sendConsentDocument(res, version, 'attachment');
  }),
);
