import { config } from '../utils/config/config.js';

/** File extensions a public link may use for each stored MIME type (the extension must match the content). */
export const EXTENSIONS_BY_MIME: Record<string, string[]> = {
  'application/pdf': [ 'pdf' ],
  'image/png': [ 'png' ],
  'image/jpeg': [ 'jpeg', 'jpg' ],
};

/**
 * The link a patient opens for a consent version: the path the approved WhatsApp welcome template uses. The extension
 * follows the stored type (a migrated legacy upload may be an image); new versions are PDF. The one place this link
 * is built: the Portal reads it from `currentVersion.url`.
 */
export function consentDocumentUrl(version: { id: string; mimeType: string }): string {
  const ext = EXTENSIONS_BY_MIME[ version.mimeType ]?.[ 0 ] ?? 'pdf';
  return `${config.publicApiOrigin}/v1/consent-document/public/download/${version.id}.${ext}`;
}
