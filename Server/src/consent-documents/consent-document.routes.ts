import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../utils/api/async-handler.js';
import { apiError } from '../utils/api/api-utils.js';
import { logger } from '../utils/api/logger.js';
import { createPublicLimiter } from '../middlewares/public-rate-limit.js';
import { patientTypeService } from '../patient-types/patient-type.service.js';
import { sendConsentDocument } from './send-consent-document.js';
import { config } from '../utils/config/config.js';

/**
 * Public consent downloads. Providers manage consent PDFs per patient type (`/v1/patient-types`); this router keeps
 * only the link patients receive.
 */
export const consentDocumentRouter = Router();
const CUID_RE = /^c[a-z0-9]{24}$/;
const ALLOWED_MIME_TYPES = new Set([ 'application/pdf', 'image/jpeg', 'image/png' ]);

/** File extensions a link may use for each stored MIME type (the extension must match the content). */
const EXTENSIONS_BY_MIME: Record<string, string[]> = {
    'application/pdf': [ 'pdf' ],
    'image/png': [ 'png' ],
    'image/jpeg': [ 'jpeg', 'jpg' ],
};

/**
 * The link a patient opens for a consent version: the path the approved WhatsApp welcome template uses. The extension
 * follows the stored type (a migrated legacy upload may be an image); new versions are PDF.
 */
export function consentDocumentUrl(version: { id: string; mimeType: string }): string {
    const ext = EXTENSIONS_BY_MIME[ version.mimeType ]?.[ 0 ] ?? 'pdf';
    return `${config.publicApiOrigin}/v1/consent-document/public/download/${version.id}.${ext}`;
}

// Public, unauthenticated download: stricter than the provider API limiter. In-memory, so the limit
// is per instance and resets on restart (see AGENTS.md).
const publicDownloadLimiter = createPublicLimiter({ name: 'consent-download', windowMs: 60_000, max: 20 });

/**
 * GET /consent-document/public/download/:id.:ext
 * No authentication. The approved WhatsApp welcome template links
 * `https://api.patientnova.net/v1/consent-document/public/download/{{8}}.pdf`, so this path must not change.
 * `:id` is a consent version id, or (messages sent before patient types) a provider's user id, which serves the
 * current version of that provider's default type. New versions are PDF only; images are migrated legacy uploads.
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
