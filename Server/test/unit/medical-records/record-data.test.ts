import { describe, expect, it } from 'vitest';
import {
  applyDataChanges,
  checkDataChanges,
  CLINICAL_KEYS,
  columnChanges,
  dataDiff,
  dataFromColumns,
  parseRecordData,
  RECORD_DATA_MAX_LENGTH,
} from '../../../src/medical-records/record-data.js';
import { RecordDataCorruptError, RecordDataInvalidError } from '../../../src/medical-records/medical-record.errors.js';
import type { RecordTemplate } from '../../../src/patient-types/record-template.js';

const template: RecordTemplate = {
  sections: [ {
    title: 'S',
    fields: [
      { key: 'motivo', label: 'Motivo', kind: 'longText', required: false, removedAt: null },
      { key: 'viejo', label: 'Viejo', kind: 'text', required: false, removedAt: '2026-01-01T00:00:00.000Z' },
    ],
  } ],
};

describe('record payload helpers', () => {
  it('lists the 21 clinical columns in schema order', () => {
    expect(CLINICAL_KEYS).toHaveLength(21);
    expect(CLINICAL_KEYS[ 0 ]).toBe('consultationReason');
    expect(CLINICAL_KEYS[ 20 ]).toBe('flexibility');
  });

  it('parses a stored payload, null being empty', () => {
    expect(parseRecordData(null)).toEqual({});
    expect(parseRecordData('{"a":"1"}')).toEqual({ a: '1' });
  });

  it('refuses a corrupt payload with a message that quotes nothing of it', () => {
    for (const stored of [ 'Duelo de María', '{"a": "Duelo de María"', '"Duelo de María"', '["Duelo de María"]', '{"a": 1}', 'null' ]) {
      let error: unknown;
      try {
        parseRecordData(stored);
      } catch (err) {
        error = err;
      }
      expect(error, stored).toBeInstanceOf(RecordDataCorruptError);
      expect((error as Error).message).not.toContain('María');
      expect((error as Error).message).not.toContain('Duelo');
    }
  });

  it('builds the payload from the columns, skipping null and empty ones', () => {
    expect(dataFromColumns({ consultationReason: 'a', objective: '', genogram: null })).toEqual({ consultationReason: 'a' });
  });

  it('turns the columns a write sends into changes, null clearing', () => {
    expect(columnChanges({ objective: null, rule: 'x', genogram: undefined })).toEqual({ objective: '', rule: 'x' });
    expect(columnChanges({ name: 'N' } as never)).toEqual({});
  });

  it('merges changes, an empty string clearing a key and other keys kept', () => {
    expect(applyDataChanges({ a: '1', old: 'kept' }, { a: '', b: '2' })).toEqual({ old: 'kept', b: '2' });
  });
});

describe('checkDataChanges', () => {
  it('accepts active keys with strings up to the limit', () => {
    expect(() => checkDataChanges(template, { motivo: 'x'.repeat(RECORD_DATA_MAX_LENGTH) })).not.toThrow();
    expect(() => checkDataChanges(template, { motivo: '' })).not.toThrow();
  });

  it('refuses removed or unknown keys, non-strings and values over the limit', () => {
    for (const changes of [
      { viejo: 'x' },
      { otro: 'x' },
      { motivo: 3 },
      { motivo: null },
      { motivo: 'x'.repeat(RECORD_DATA_MAX_LENGTH + 1) },
    ]) {
      expect(() => checkDataChanges(template, changes), JSON.stringify(changes).slice(0, 40)).toThrow(RecordDataInvalidError);
    }
  });
});

describe('dataDiff', () => {
  it('lists only the keys whose value changed, with null for an absent key', () => {
    expect(dataDiff({ a: '1', b: '2', d: '9' }, { a: '1', b: '3', c: '4' })).toEqual({
      affectedFields: [ 'data.b', 'data.c', 'data.d' ],
      fieldsBefore: { 'data.b': '2', 'data.c': null, 'data.d': '9' },
      fieldsAfter: { 'data.b': '3', 'data.c': '4', 'data.d': null },
    });
  });

  it('is empty for equal payloads', () => {
    expect(dataDiff({ a: '1' }, { a: '1' })).toEqual({ affectedFields: [], fieldsBefore: {}, fieldsAfter: {} });
  });
});
