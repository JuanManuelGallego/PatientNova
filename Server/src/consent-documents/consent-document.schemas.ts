import { z } from 'zod';

export const createConsentDocumentSchema = z.object({
    name: z.string().min(1).max(255),
    content: z.string().min(1), // base64 encoded content or data URL
    mimeType: z.string().default('application/pdf'),
});

export const updateConsentDocumentSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    content: z.string().min(1).optional(), // base64 encoded content or data URL
    mimeType: z.string().optional(),
});

export type CreateConsentDocumentDto = z.infer<typeof createConsentDocumentSchema>;
export type UpdateConsentDocumentDto = z.infer<typeof updateConsentDocumentSchema>;
