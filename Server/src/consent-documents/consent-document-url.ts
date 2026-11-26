import { config } from '../utils/config/config.js';

export const EXTENSIONS_BY_MIME: Record<string, string[]> = {
  'application/pdf': [ 'pdf' ],
  'image/png': [ 'png' ],
  'image/jpeg': [ 'jpeg', 'jpg' ],
};

export function consentDocumentUrl(version: { id: string; mimeType: string }): string {
  const ext = EXTENSIONS_BY_MIME[ version.mimeType ]?.[ 0 ] ?? 'pdf';
  return `${config.publicApiOrigin}/v1/consent-document/public/download/${version.id}.${ext}`;
}
