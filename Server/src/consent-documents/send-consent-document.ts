import type { Response } from 'express';

export function sendConsentDocument(
  res: Response,
  document: { name: string; mimeType: string; content: Uint8Array; sizeBytes: number | null },
  disposition: 'inline' | 'attachment',
): void {
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const encoded = encodeURIComponent(document.name);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encoded}"; filename*=UTF-8''${encoded}`);
  res.setHeader('Content-Length', document.sizeBytes ?? document.content.byteLength);
  res.status(200).send(Buffer.from(document.content));
}
