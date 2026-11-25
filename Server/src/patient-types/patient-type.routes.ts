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

/** Mounted with `authenticate` + `requireAdminForWrites`: a VIEWER reads, ADMIN and SUPER_ADMIN write. */
export const patientTypeRouter = Router();

/** GET /patient-types — the provider's types, each with its patient count and current consent version. */
patientTypeRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.list(req.user!.id));
  }),
);

/** POST /patient-types */
patientTypeRouter.post(
  '/',
  validateBody(createPatientTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.create(req.user!.id, req.body), 201);
  }),
);

/** PATCH /patient-types/:id — rename. */
patientTypeRouter.patch(
  '/:id',
  validateParams(patientTypeParamsSchema),
  validateBody(updatePatientTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.update(req.user!.id, req.params.id as string, req.body));
  }),
);

/** POST /patient-types/:id/default — make it the type new patients start with. */
patientTypeRouter.post(
  '/:id/default',
  validateParams(patientTypeParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.setDefault(req.user!.id, req.params.id as string));
  }),
);

/** DELETE /patient-types/:id — 409 for the default type or while any patient uses it. */
patientTypeRouter.delete(
  '/:id',
  validateParams(patientTypeParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.delete(req.user!.id, req.params.id as string));
  }),
);

/** GET /patient-types/:id/consent-versions — newest first, metadata only. */
patientTypeRouter.get(
  '/:id/consent-versions',
  validateParams(patientTypeParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.listVersions(req.user!.id, req.params.id as string));
  }),
);

/** POST /patient-types/:id/consent-versions — upload a PDF as the next version. */
patientTypeRouter.post(
  '/:id/consent-versions',
  validateParams(patientTypeParamsSchema),
  validateBody(createConsentVersionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await patientTypeService.addVersion(req.user!.id, req.params.id as string, req.body), 201);
  }),
);

/** GET /patient-types/:id/consent-versions/:versionId/download — the PDF bytes. */
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
