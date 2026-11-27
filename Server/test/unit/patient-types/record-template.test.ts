import { describe, expect, it } from 'vitest';
import {
  applyTemplateWrite,
  keyFromLabel,
  recordTemplateSchema,
  type RecordTemplate,
  type TemplateField,
} from '../../../src/patient-types/record-template.js';
import { RecordTemplateInvalidError } from '../../../src/patient-types/patient-type.errors.js';

const KEY = /^[a-z][a-zA-Z0-9]{0,63}$/;
const NOW = new Date('2026-11-26T15:00:00.000Z');

const field = (key: string, overrides: Partial<TemplateField> = {}): TemplateField => ({
  key,
  label: key,
  kind: 'longText',
  required: false,
  removedAt: null,
  ...overrides,
});

const previous: RecordTemplate = {
  sections: [ { title: 'A', fields: [ field('motivo', { label: 'Motivo' }) ] } ],
};

const fields = (count: number, removed = false) =>
  Array.from({ length: count }, (_, i) => field(`f${i}`, removed ? { removedAt: NOW.toISOString() } : {}));

describe('keyFromLabel', () => {
  it('camelCases the label without accents', () => {
    expect(keyFromLabel('Motivo de consulta', new Set())).toBe('motivoDeConsulta');
    expect(keyFromLabel('Hábitos y estilo de vida', new Set())).toBe('habitosYEstiloDeVida');
  });

  it('adds a numeric suffix on collision, removed keys included', () => {
    expect(keyFromLabel('Objetivo', new Set([ 'objetivo' ]))).toBe('objetivo2');
    expect(keyFromLabel('Objetivo', new Set([ 'objetivo', 'objetivo2' ]))).toBe('objetivo3');
  });

  it('always returns a valid key', () => {
    for (const label of [ '¿?', '2024 notas', 'x'.repeat(120), 'Ñandú' ]) {
      expect(keyFromLabel(label, new Set())).toMatch(KEY);
    }
    expect(keyFromLabel('¿?', new Set())).toBe('campo');
    expect(keyFromLabel('2024 notas', new Set())).toBe('campo2024Notas');
    const long = 'x'.repeat(120);
    const first = keyFromLabel(long, new Set());
    const second = keyFromLabel(long, new Set([ first ]));
    expect(second).toHaveLength(64);
    expect(second).toMatch(KEY);
    expect(second).not.toBe(first);
  });
});

describe('recordTemplateSchema', () => {
  it('accepts the empty template', () => {
    expect(recordTemplateSchema.parse({ sections: [] })).toEqual({ sections: [] });
  });

  it('refuses 21 sections and 101 fields, removed fields included', () => {
    const sections = Array.from({ length: 21 }, (_, i) => ({ title: `S${i}`, fields: [] }));
    expect(recordTemplateSchema.safeParse({ sections }).success).toBe(false);
    expect(recordTemplateSchema.safeParse({ sections: sections.slice(0, 20) }).success).toBe(true);
    const many = [ ...fields(50), ...fields(51, true).map((f) => ({ ...f, key: `r${f.key}` })) ];
    expect(recordTemplateSchema.safeParse({ sections: [ { title: 'S', fields: many } ] }).success).toBe(false);
    expect(recordTemplateSchema.safeParse({ sections: [ { title: 'S', fields: many.slice(0, 100) } ] }).success).toBe(true);
  });

  it('refuses empty or 121-character titles and labels, and duplicate or malformed keys', () => {
    const one = (section: unknown) => recordTemplateSchema.safeParse({ sections: [ section ] }).success;
    expect(one({ title: '', fields: [] })).toBe(false);
    expect(one({ title: '   ', fields: [] })).toBe(false);
    expect(one({ title: 'x'.repeat(121), fields: [] })).toBe(false);
    expect(one({ title: 'x'.repeat(120), fields: [] })).toBe(true);
    expect(one({ title: 'S', fields: [ field('a', { label: '' }) ] })).toBe(false);
    expect(one({ title: 'S', fields: [ field('a', { label: 'x'.repeat(121) }) ] })).toBe(false);
    expect(one({ title: 'S', fields: [ field('a'), field('a') ] })).toBe(false);
    expect(recordTemplateSchema.safeParse({
      sections: [ { title: 'S', fields: [ field('a') ] }, { title: 'T', fields: [ field('a') ] } ],
    }).success).toBe(false);
    for (const key of [ 'A', '1a', 'a-b', 'a'.repeat(65), '' ]) {
      expect(one({ title: 'S', fields: [ field(key) ] }), key).toBe(false);
    }
    expect(one({ title: 'S', fields: [ field('a', { kind: 'number' as never }) ] })).toBe(false);
  });
});

describe('applyTemplateWrite', () => {
  it('generates keys for new fields and keeps existing ones', () => {
    const next = applyTemplateWrite(previous, {
      sections: [ {
        title: 'A',
        fields: [
          { key: 'motivo', label: 'Motivo', kind: 'longText' },
          { label: 'Motivo', kind: 'text' },
          { label: 'Notas', kind: 'text', required: true },
        ],
      } ],
    }, NOW);
    expect(next.sections[ 0 ]!.fields).toEqual([
      field('motivo', { label: 'Motivo' }),
      field('motivo2', { label: 'Motivo', kind: 'text' }),
      field('notas', { label: 'Notas', kind: 'text', required: true }),
    ]);
  });

  it('lets a label, required flag, order and section change, keeping the key', () => {
    const start: RecordTemplate = { sections: [ { title: 'A', fields: [ field('motivo'), field('otro') ] } ] };
    const next = applyTemplateWrite(start, {
      sections: [
        { title: 'A', fields: [ { key: 'otro', label: 'Otro', kind: 'longText' } ] },
        { title: 'B', fields: [ { key: 'motivo', label: 'Motivo nuevo', kind: 'longText', required: true } ] },
      ],
    }, NOW);
    expect(next).toEqual({
      sections: [
        { title: 'A', fields: [ field('otro', { label: 'Otro' }) ] },
        { title: 'B', fields: [ field('motivo', { label: 'Motivo nuevo', required: true }) ] },
      ],
    });
  });

  it('sets removedAt to now on removal and keeps the field', () => {
    const next = applyTemplateWrite(previous, {
      sections: [ { title: 'A', fields: [ { key: 'motivo', label: 'Motivo', kind: 'longText', removedAt: '1999-01-01T00:00:00.000Z' } ] } ],
    }, NOW);
    expect(next.sections[ 0 ]!.fields[ 0 ]).toEqual(field('motivo', { label: 'Motivo', removedAt: NOW.toISOString() }));
  });

  it('keeps the stored removedAt when a removed field is sent again', () => {
    const removedAt = '2026-01-01T00:00:00.000Z';
    const start: RecordTemplate = { sections: [ { title: 'A', fields: [ field('motivo', { removedAt }) ] } ] };
    const next = applyTemplateWrite(start, {
      sections: [ { title: 'A', fields: [ { key: 'motivo', label: 'Motivo', kind: 'longText', removedAt: NOW.toISOString() } ] } ],
    }, NOW);
    expect(next.sections[ 0 ]!.fields[ 0 ]!.removedAt).toBe(removedAt);
  });

  it('a new field reuses no removed key', () => {
    const start: RecordTemplate = { sections: [ { title: 'A', fields: [ field('motivo', { removedAt: NOW.toISOString() }) ] } ] };
    const next = applyTemplateWrite(start, {
      sections: [ { title: 'A', fields: [
        { key: 'motivo', label: 'motivo', kind: 'longText', removedAt: NOW.toISOString() },
        { label: 'Motivo', kind: 'longText' },
      ] } ],
    }, NOW);
    expect(next.sections[ 0 ]!.fields.map((f) => f.key)).toEqual([ 'motivo', 'motivo2' ]);
  });

  it('refuses clearing removedAt, changing kind, dropping a key, a repeated key or an unknown key', () => {
    const removed: RecordTemplate = { sections: [ { title: 'A', fields: [ field('motivo', { removedAt: NOW.toISOString() }) ] } ] };
    const attempts: [ RecordTemplate, unknown ][] = [
      [ removed, { sections: [ { title: 'A', fields: [ { key: 'motivo', label: 'M', kind: 'longText', removedAt: null } ] } ] } ],
      [ removed, { sections: [ { title: 'A', fields: [ { key: 'motivo', label: 'M', kind: 'longText' } ] } ] } ],
      [ previous, { sections: [ { title: 'A', fields: [ { key: 'motivo', label: 'Motivo', kind: 'text' } ] } ] } ],
      [ previous, { sections: [ { title: 'A', fields: [] } ] } ],
      [ previous, { sections: [] } ],
      [ previous, { sections: [ { title: 'A', fields: [
        { key: 'motivo', label: 'Motivo', kind: 'longText' },
        { key: 'motivo', label: 'Motivo', kind: 'longText' },
      ] } ] } ],
      [ previous, { sections: [ { title: 'A', fields: [
        { key: 'motivo', label: 'Motivo', kind: 'longText' },
        { key: 'inventado', label: 'Inventado', kind: 'text' },
      ] } ] } ],
    ];
    for (const [ start, input ] of attempts) {
      expect(() => applyTemplateWrite(start, input as never, NOW), JSON.stringify(input)).toThrow(RecordTemplateInvalidError);
    }
  });

  it('refuses a new field that arrives already removed', () => {
    expect(() => applyTemplateWrite({ sections: [] }, {
      sections: [ { title: 'A', fields: [ { label: 'Nuevo', kind: 'text', removedAt: NOW.toISOString() } ] } ],
    }, NOW)).toThrow(RecordTemplateInvalidError);
  });

  it('counts removed fields against the 100-field limit', () => {
    const start: RecordTemplate = { sections: [ { title: 'A', fields: fields(100, true) } ] };
    expect(() => applyTemplateWrite(start, {
      sections: [ { title: 'A', fields: [ ...start.sections[ 0 ]!.fields, { label: 'Uno más', kind: 'text' } ] } ],
    }, NOW)).toThrow(RecordTemplateInvalidError);
  });

  it('refuses an invalid result, such as a blank label', () => {
    expect(() => applyTemplateWrite(previous, {
      sections: [ { title: 'A', fields: [ { key: 'motivo', label: '  ', kind: 'longText' } ] } ],
    }, NOW)).toThrow(RecordTemplateInvalidError);
  });
});
