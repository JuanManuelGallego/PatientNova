import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../utils/api/async-handler.js';
import { apiError } from '../utils/api/api-utils.js';
import { logger } from '../utils/api/logger.js';
import { createPublicLimiter } from '../middlewares/public-rate-limit.js';
import { patientTypeService } from '../patient-types/patient-type.service.js';
import { sendConsentDocument } from './send-consent-document.js';
import { EXTENSIONS_BY_MIME } from './consent-document-url.js';

export const consentDocumentRouter = Router();
const CUID_RE = /^c[a-z0-9]{24}$/;
const ALLOWED_MIME_TYPES = new Set([ 'application/pdf', 'image/jpeg', 'image/png' ]);

// Public, unauthenticated download: stricter than the provider API limiter. In-memory, so the limit
// is per instance and resets on restart (see AGENTS.md).
const publicDownloadLimiter = createPublicLimiter({ name: 'consent-download', windowMs: 60_000, max: 20 });

/**
 * GET /consent-documents/public/download/:id.:ext
 * Public endpoint — download a consent document by ID and file extension.
 * No authentication required. Validates extension, ID format, and MIME type.
 */
consentDocumentRouter.get(
    '/public/download/:id.:ext',
    publicDownloadLimiter,
    asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const ext = (req.params.ext as string).toLowerCase();
        const ip = req.ip ?? 'unknown';

        if (![ 'pdf', 'png', 'jpeg', 'jpg' ].includes(ext)) {
            logger.info({ ip, ext }, 'Public download rejected: invalid extension');
            apiError(res, 'Invalid file extension requested', 400);
            return;
        }

        if (!CUID_RE.test(id)) {
            logger.info({ ip }, 'Public download rejected: invalid id');
            apiError(res, 'Invalid id', 400);
            return;
        }

        const document = await patientTypeService.findPublicDocument(id);
        if (!document) {
            logger.info({ ip }, 'Public download rejected: not found');
            apiError(res, 'Document not found', 404);
            return;
        }

        if (!ALLOWED_MIME_TYPES.has(document.mimeType)) {
            logger.info({ ip, mimeType: document.mimeType }, 'Public download rejected: unsupported type');
            apiError(res, 'Unsupported document type', 415);
            return;
        }

        if (!EXTENSIONS_BY_MIME[ document.mimeType ]?.includes(ext)) {
            // Same answer as "no document": do not reveal which type is stored.
            logger.info({ ip, ext, mimeType: document.mimeType }, 'Public download rejected: extension does not match content type');
            apiError(res, 'Document not found', 404);
            return;
        }

        sendConsentDocument(res, document, 'inline');
    })
);
