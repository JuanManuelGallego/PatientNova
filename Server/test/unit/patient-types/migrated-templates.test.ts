import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILY_TEMPLATE, INDIVIDUAL_TEMPLATE } from '../../../src/patient-types/migrated-templates.js';
import { recordTemplateSchema } from '../../../src/patient-types/record-template.js';
import { CLINICAL_KEYS } from '../../../src/medical-records/record-data.js';

const sql = readFileSync(join(__dirname, '../../../migrations/20261127000000_record_templates/migration.sql'), 'utf8');
const literal = (tag: string) => JSON.parse(new RegExp(`\\$${tag}\\$(.*?)\\$${tag}\\$`, 's').exec(sql)![ 1 ]!);
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
