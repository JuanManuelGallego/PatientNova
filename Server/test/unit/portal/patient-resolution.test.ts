import { describe, expect, it } from 'vitest';
import { PatientStatus } from '../../../generated/prisma/enums.js';
import { classifyPortalMatch } from '../../../src/portal/patient-resolution.js';

const active = (overrides: Partial<{ status: PatientStatus; portalAccessEnabled: boolean }> = {}) => ({
  id: 'p1',
  status: PatientStatus.ACTIVE,
  portalAccessEnabled: true,
  isDeleted: false,
  ...overrides,
});

describe('classifyPortalMatch', () => {
  it('an active patient with portal access is a patient', () => {
    expect(classifyPortalMatch({ active: active(), hasDeleted: false })).toEqual({ kind: 'patient', patientId: 'p1' });
  });

  it('a soft-deleted twin does not hide the active patient', () => {
    expect(classifyPortalMatch({ active: active(), hasDeleted: true })).toEqual({ kind: 'patient', patientId: 'p1' });
  });

  it('revoked portal access is unavailable', () => {
    expect(classifyPortalMatch({ active: active({ portalAccessEnabled: false }), hasDeleted: false })).toEqual({ kind: 'unavailable' });
  });

  it('an INACTIVE patient is unavailable', () => {
    expect(classifyPortalMatch({ active: active({ status: PatientStatus.INACTIVE }), hasDeleted: false })).toEqual({ kind: 'unavailable' });
  });

  it('only soft-deleted matches are unavailable', () => {
    expect(classifyPortalMatch({ active: null, hasDeleted: true })).toEqual({ kind: 'unavailable' });
  });

  it('no match is none', () => {
    expect(classifyPortalMatch({ active: null, hasDeleted: false })).toEqual({ kind: 'none' });
  });
});
