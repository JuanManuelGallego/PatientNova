import { z } from 'zod';

const name = z.string().trim().min(1, 'name is required').max(80);

export const createPatientTypeSchema = z.object({ name });

export const updatePatientTypeSchema = z.object({ name });

export const patientTypeParamsSchema = z.object({ id: z.uuid() });

export const consentVersionParamsSchema = z.object({
  id: z.uuid(),
  versionId: z.string().regex(/^c[a-z0-9]{24}$/),
});

export const createConsentVersionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  content: z.string().min(1),
});

export type CreatePatientTypeDto = z.infer<typeof createPatientTypeSchema>;
export type UpdatePatientTypeDto = z.infer<typeof updatePatientTypeSchema>;
export type CreateConsentVersionDto = z.infer<typeof createConsentVersionSchema>;
