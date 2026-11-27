import { z } from 'zod';
import { RecordTemplateInvalidError } from './patient-type.errors.js';

export const FIELD_KINDS = [ 'text', 'longText' ] as const;
export const MAX_TEMPLATE_SECTIONS = 20;
export const MAX_TEMPLATE_FIELDS = 100;
export const MAX_TEMPLATE_TEXT = 120;
export const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{0,63}$/;
const MAX_KEY_LENGTH = 64;
const FALLBACK_KEY = 'campo';

export type FieldKind = (typeof FIELD_KINDS)[ number ];

export interface TemplateField {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  removedAt: string | null;
}

export interface TemplateSection {
  title: string;
  fields: TemplateField[];
}

export interface RecordTemplate {
  sections: TemplateSection[];
}

const text = z.string().trim().min(1).max(MAX_TEMPLATE_TEXT);

const storedField = z.object({
  key: z.string().regex(FIELD_KEY_PATTERN),
  label: text,
  kind: z.enum(FIELD_KINDS),
  required: z.boolean(),
  removedAt: z.iso.datetime().nullable(),
}).strict();

export const recordTemplateSchema = z.object({
  sections: z.array(z.object({ title: text, fields: z.array(storedField) }).strict()).max(MAX_TEMPLATE_SECTIONS),
}).strict().superRefine((template, ctx) => {
  const keys = template.sections.flatMap((s) => s.fields.map((f) => f.key));
  if (keys.length > MAX_TEMPLATE_FIELDS) {
    ctx.addIssue({ code: 'custom', message: `at most ${MAX_TEMPLATE_FIELDS} fields` });
  }
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: 'custom', message: 'field keys must be unique' });
  }
}) satisfies z.ZodType<RecordTemplate>;

const writeField = z.object({
  key: z.string().regex(FIELD_KEY_PATTERN).optional(),
  label: z.string(),
  kind: z.enum(FIELD_KINDS),
  required: z.boolean().optional(),
  removedAt: z.string().nullable().optional(),
}).strict();

export const templateWriteSchema = z.object({
  sections: z.array(z.object({ title: z.string(), fields: z.array(writeField).max(MAX_TEMPLATE_FIELDS) }).strict())
    .max(MAX_TEMPLATE_SECTIONS),
}).strict();

export type TemplateWriteInput = z.infer<typeof templateWriteSchema>;

export function parseStoredTemplate(json: unknown): RecordTemplate {
  return recordTemplateSchema.parse(json);
}

export function activeKeys(template: RecordTemplate): Set<string> {
  return new Set(template.sections.flatMap((s) => s.fields.filter((f) => f.removedAt === null).map((f) => f.key)));
}

function slug(label: string): string {
  const words = label.normalize('NFD').replace(/\p{M}/gu, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.toLowerCase());
  const camel = (list: string[]) => list.map((w) => w[ 0 ]!.toUpperCase() + w.slice(1)).join('');
  if (words.length === 0) return FALLBACK_KEY;
  if (/^[0-9]/.test(words[ 0 ]!)) return FALLBACK_KEY + camel(words);
  return words[ 0 ]! + camel(words.slice(1));
}

export function keyFromLabel(label: string, taken: ReadonlySet<string>): string {
  const base = slug(label);
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : String(n);
    const key = base.slice(0, MAX_KEY_LENGTH - suffix.length) + suffix;
    if (!taken.has(key)) return key;
  }
}

function invalid(reason: string): never {
  throw new RecordTemplateInvalidError(reason);
}

export function applyTemplateWrite(previous: RecordTemplate, input: TemplateWriteInput, now: Date): RecordTemplate {
  const before = new Map(previous.sections.flatMap((s) => s.fields.map((f) => [ f.key, f ] as const)));
  const taken = new Set(before.keys());
  const seen = new Set<string>();

  const sections = input.sections.map((section) => ({
    title: section.title,
    fields: section.fields.map((f): TemplateField => {
      if (f.key === undefined) {
        if (f.removedAt) invalid('un campo nuevo no puede llegar eliminado');
        const key = keyFromLabel(f.label, taken);
        taken.add(key);
        seen.add(key);
        return { key, label: f.label, kind: f.kind, required: f.required ?? false, removedAt: null };
      }
      const old = before.get(f.key) ?? invalid('un campo no existe en la plantilla');
      if (seen.has(f.key)) invalid('un campo aparece dos veces');
      seen.add(f.key);
      if (f.kind !== old.kind) invalid('no se puede cambiar el tipo de un campo');
      if (old.removedAt !== null && !f.removedAt) invalid('no se puede restaurar un campo eliminado');
      const removedAt = old.removedAt ?? (f.removedAt ? now.toISOString() : null);
      return { key: f.key, label: f.label, kind: f.kind, required: f.required ?? old.required, removedAt };
    }),
  }));

  for (const key of before.keys()) {
    if (!seen.has(key)) invalid('no se puede quitar un campo; márcalo como eliminado');
  }

  const result = recordTemplateSchema.safeParse({ sections });
  if (!result.success) invalid('revisa los títulos, los nombres de los campos y los límites');
  return result.data;
}
