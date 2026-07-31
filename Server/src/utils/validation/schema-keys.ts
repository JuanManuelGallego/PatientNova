import { z } from 'zod';

/**
 * Extract the string keys from a Zod object schema's shape.
 * Use this to derive diff-field lists directly from update schemas,
 * keeping them in sync automatically.
 *
 * @example
 * const PATIENT_DIFF_FIELDS = schemaKeys(updatePatientSchema);
 */
export function schemaKeys<T extends z.ZodObject<z.ZodRawShape>>(schema: T): (keyof z.infer<T> & string)[] {
  return Object.keys(schema.shape) as (keyof z.infer<T> & string)[];
}
