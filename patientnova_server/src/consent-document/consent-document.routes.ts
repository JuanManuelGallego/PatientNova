import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiUtils.js';
import { logger } from '../utils/logger.js';
import { consentDocumentRepository } from './consent-document.repository.js';
import { createConsentDocumentSchema, updateConsentDocumentSchema } from './consent-document.schemas.js';

export const consentDocumentRouter = Router();
const CUID_RE = /^c[a-z0-9]{24}$/;
const ALLOWED_MIME_TYPES = new Set([ 'application/pdf', 'image/jpeg', 'image/png' ]);

/**
 * POST /consent-document
 * Upload a consent document for the authenticated user.
 * Only one consent document per user is allowed.
 */
consentDocumentRouter.post(
    '/',
    authenticate,
    validateBody(createConsentDocumentSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const document = await consentDocumentRepository.create(req.body, req.user!.id);
        logger.info({ userId: req.user!.id, documentId: document.id }, 'Consent document created');

        // Return document info without content (for initial response)
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

/**
 * GET /consent-document
 * Get the authenticated user's consent document metadata.
 */
consentDocumentRouter.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const document = await consentDocumentRepository.findByUserIdOrNull(req.user!.id);
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

/**
 * GET /consent-document/download
 * Download the authenticated user's consent document (includes base64 content).
 */
consentDocumentRouter.get(
    '/download',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const document = await consentDocumentRepository.getContent(req.user!.id);
        ok(res, document);
    })
);

/**
 * PATCH /consent-document
 * Update the authenticated user's consent document.
 */
consentDocumentRouter.patch(
    '/',
    authenticate,
    validateBody(updateConsentDocumentSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const document = await consentDocumentRepository.update(req.user!.id, req.body);
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

/**
 * DELETE /consent-document
 * Delete the authenticated user's consent document.
 */
consentDocumentRouter.delete(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        await consentDocumentRepository.delete(req.user!.id);
        logger.info({ userId: req.user!.id }, 'Consent document deleted');
        ok(res, { message: 'Consent document deleted successfully' });
    })
);

/**
 * GET /consent-document/public/download/:userId
 * Public endpoint to download a user's consent document for WhatsApp sharing.
 * Returns the file as binary for direct download.
 */
consentDocumentRouter.get(
    '/public/download/:userId',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.params.userId as string;

        if (!CUID_RE.test(userId)) {
            res.status(400).json({ error: 'Invalid userId' });
            return;
        }
        const document = await consentDocumentRepository.getContentByUserId(userId);
        if (!document) {
            res.status(404).json({ error: 'Document not found' });
            return;
        }

        if (!ALLOWED_MIME_TYPES.has(document.mimeType)) {
            res.status(415).json({ error: 'Unsupported document type' });
            return;
        }

        // Set response headers for file download
        res.setHeader('Content-Type', document.mimeType);
        const encoded = encodeURIComponent(document.name);
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`
        );

        const length = document.sizeBytes ?? Buffer.byteLength(document.content);
        res.setHeader('Content-Length', length);

        // Send binary content
        res.send(document.content);
    })
);
