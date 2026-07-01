import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiUtils.js';
import { logger } from '../utils/logger.js';
import { consentDocumentService } from './consent-document.service.js';
import { createConsentDocumentSchema, updateConsentDocumentSchema } from './consent-document.schemas.js';

export const consentDocumentRouter = Router();
const CUID_RE = /^c[a-z0-9]{24}$/;
const ALLOWED_MIME_TYPES = new Set([ 'application/pdf', 'image/jpeg', 'image/png' ]);

consentDocumentRouter.post(
    '/',
    authenticate,
    validateBody(createConsentDocumentSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const document = await consentDocumentService.create(req.body, req.user!.id);
        logger.info({ userId: req.user!.id, documentId: document.id }, 'Consent document created');

        ok(res, {
            id: document.id,
            name: document.name,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
        }, 201);
    })
);

consentDocumentRouter.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const document = await consentDocumentService.findByUserIdOrNull(req.user!.id);
        if (!document) {
            ok(res, null);
            return;
        }

        ok(res, {
            id: document.id,
            name: document.name,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
        });
    })
);

consentDocumentRouter.get(
    '/download',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const document = await consentDocumentService.getContent(req.user!.id);
        ok(res, document);
    })
);

consentDocumentRouter.patch(
    '/',
    authenticate,
    validateBody(updateConsentDocumentSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const document = await consentDocumentService.update(req.user!.id, req.body);
        logger.info({ userId: req.user!.id, documentId: document.id }, 'Consent document updated');

        ok(res, {
            id: document.id,
            name: document.name,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
        });
    })
);

consentDocumentRouter.delete(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        await consentDocumentService.delete(req.user!.id);
        logger.info({ userId: req.user!.id }, 'Consent document deleted');
        ok(res, { message: 'Consent document deleted successfully' });
    })
);

consentDocumentRouter.get(
    '/public/download/:userId.:ext',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.params.userId as string;
        const ext = req.params.ext as string;

        if (![ 'pdf', 'png', 'jpeg', 'jpg' ].includes(ext.toLowerCase())) {
            res.error('Invalid file extension requested', 400);
            return;
        }

        if (!CUID_RE.test(userId)) {
            res.error('Invalid userId', 400);
            return;
        }

        const document = await consentDocumentService.getContentByUserId(userId);
        if (!document) {
            res.error('Document not found', 404);
            return;
        }

        if (!ALLOWED_MIME_TYPES.has(document.mimeType)) {
            res.error('Unsupported document type', 415);
            return;
        }

        res.setHeader('Content-Type', document.mimeType);

        const encoded = encodeURIComponent(document.name);
        res.setHeader(
            'Content-Disposition',
            `inline; filename="${encoded}"; filename*=UTF-8''${encoded}`
        );

        const length = document.sizeBytes ?? Buffer.byteLength(document.content);
        res.setHeader('Content-Length', length);

        res.send(document.content);
    })
);
