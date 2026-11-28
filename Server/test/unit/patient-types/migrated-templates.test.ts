import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FAMILY_TEMPLATE,
  FAMILY_TEMPLATE_WITH_LEGACY,
  INDIVIDUAL_TEMPLATE,
  INDIVIDUAL_TEMPLATE_WITH_LEGACY,
  LEGACY_REMOVED_AT,
} from '../../../src/patient-types/migrated-templates.js';
import { recordTemplateSchema } from '../../../src/patient-types/record-template.js';
import { CLINICAL_KEYS } from '../../../src/medical-records/record-data.js';

const sql = readFileSync(join(__dirname, '../../../migrations/20261127000000_record_templates/migration.sql'), 'utf8');
const literalIn = (source: string, tag: string) => JSON.parse(new RegExp(`\\$${tag}\\$(.*?)\\$${tag}\\$`, 's').exec(source)![ 1 ]!);
const literal = (tag: string) => literalIn(sql, tag);
const sqlB = readFileSync(join(__dirname, '../../../migrations/20261128000000_record_snapshots/migration.sql'), 'utf8');
const labels = (template: typeof INDIVIDUAL_TEMPLATE) =>
  template.sections.map((s) => [ s.title, s.fields.map((f) => `${f.key}: ${f.label}`) ]);

describe('migrated templates', () => {
  it('the migration writes exactly the TypeScript templates', () => {
    expect(literal('individual')).toEqual(INDIVIDUAL_TEMPLATE);
    expect(literal('familia')).toEqual(FAMILY_TEMPLATE);
  });

  it('both templates are valid long-text templates keyed by clinical column names', () => {
    for (const template of [ INDIVIDUAL_TEMPLATE, FAMILY_TEMPLATE ]) {
      expect(recordTemplateSchema.parse(template)).toEqual(template);
      for (const field of template.sections.flatMap((s) => s.fields)) {
        expect(CLINICAL_KEYS as readonly string[]).toContain(field.key);
        expect(field).toMatchObject({ kind: 'longText', required: false, removedAt: null });
      }
    }
  });

  it('Individual reproduces today\'s individual form', () => {
    expect(labels(INDIVIDUAL_TEMPLATE)).toEqual([
      [ 'Datos generales', [ 'consultationReason: Motivo de consulta' ] ],
      [ 'Composición familiar', [ 'familyObservations: Observaciones' ] ],
      [ 'Antecedentes', [
        'earlyDevelopment: Desarrollo temprano',
        'schoolAndWork: Escolar y laboral',
        'lifestyleHabits: Hábitos y estilo de vida',
        'traumaticEvents: Eventos traumáticos o estresores previos',
        'emotionalConsiderations: Consideraciones emocionales',
        'physicalConsiderations: Consideraciones físicas, etiología y de salud',
        'mentalHistory: Antecedentes mentales',
        'objective: Objetivo',
      ] ],
    ]);
  });

  it('Familia reproduces today\'s family form, with no Antecedentes', () => {
    expect(labels(FAMILY_TEMPLATE)).toEqual([
      [ 'Datos generales', [ 'consultationReason: Motivo de consulta' ] ],
      [ 'Aspectos específicos de la familia', [
        'familyType: Tipo de familia',
        'lifecycle: Ciclo vital',
        'genogram: Genograma',
        'resources: Recursos que tienen',
        'difficulties: Dificultades tienen',
        'communication: Comunicación',
        'rule: Reglas',
        'limits: Limites',
        'familyContext: Contexto familiar',
        'expectations: Expectativas',
        'flexibility: Flexibilidad al cambio',
      ] ],
    ]);
  });

  it('only fills migrated types still on the empty template, turning on family members for Individual', () => {
    expect(sql).toMatch(/UPDATE "patient_types" SET "template" = \$individual\$.*\$individual\$::jsonb, "familyMembersEnabled" = true\s+WHERE "name" = 'Individual' AND "template" = '\{"sections": \[\]\}'::jsonb;/s);
    expect(sql).toMatch(/UPDATE "patient_types" SET "template" = \$familia\$.*\$familia\$::jsonb\s+WHERE "name" = 'Familia' AND "template" = '\{"sections": \[\]\}'::jsonb;/s);
  });
});

describe('legacy removed fields', () => {
  const fieldsOf = (t: typeof INDIVIDUAL_TEMPLATE) => t.sections.flatMap((s) => s.fields);
  const pairs = [
    [ INDIVIDUAL_TEMPLATE, INDIVIDUAL_TEMPLATE_WITH_LEGACY ],
    [ FAMILY_TEMPLATE, FAMILY_TEMPLATE_WITH_LEGACY ],
  ] as const;

  it('each template with legacy fields holds every clinical key exactly once', () => {
    for (const [ , legacy ] of pairs) {
      expect(recordTemplateSchema.parse(legacy)).toEqual(legacy);
      const keys = fieldsOf(legacy).map((f) => f.key);
      expect(keys).toHaveLength(CLINICAL_KEYS.length);
      expect(new Set(keys)).toEqual(new Set(CLINICAL_KEYS));
    }
  });

  it('keeps the release A fields active and adds the rest as removed', () => {
    for (const [ base, legacy ] of pairs) {
      const active = new Set(fieldsOf(base).map((f) => f.key));
      expect(legacy.sections.slice(0, base.sections.length)).toEqual(base.sections);
      for (const field of fieldsOf(legacy)) {
        expect(field.removedAt).toBe(active.has(field.key) ? null : LEGACY_REMOVED_AT);
      }
    }
  });

  it("uses today's labels for the added fields", () => {
    const label = (t: typeof INDIVIDUAL_TEMPLATE, key: string) => fieldsOf(t).find((f) => f.key === key)!.label;
    expect(label(INDIVIDUAL_TEMPLATE_WITH_LEGACY, 'genogram')).toBe('Genograma');
    expect(label(FAMILY_TEMPLATE_WITH_LEGACY, 'earlyDevelopment')).toBe('Desarrollo temprano');
    expect(label(FAMILY_TEMPLATE_WITH_LEGACY, 'familyObservations')).toBe('Observaciones');
  });

  it('the release B migration writes exactly these templates, only over unchanged release A templates', () => {
    expect(literalIn(sqlB, 'individual')).toEqual(INDIVIDUAL_TEMPLATE_WITH_LEGACY);
    expect(literalIn(sqlB, 'familia')).toEqual(FAMILY_TEMPLATE_WITH_LEGACY);
    expect(literalIn(sqlB, 'individual_a')).toEqual(INDIVIDUAL_TEMPLATE);
    expect(literalIn(sqlB, 'familia_a')).toEqual(FAMILY_TEMPLATE);
    expect(sqlB).toMatch(/WHERE "name" = 'Individual' AND "template" = \$individual_a\$.*\$individual_a\$::jsonb;/s);
    expect(sqlB).toMatch(/WHERE "name" = 'Familia' AND "template" = \$familia_a\$.*\$familia_a\$::jsonb;/s);
  });
});
