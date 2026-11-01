import { z } from 'zod';

export const acceptConsentSchema = z.strictObject({
  accepted: z.literal(true),
});
