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

const match = (overrides: Partial<Parameters<typeof classifyPortalMatch>[0]> = {}) => ({
  active: null,
  hasDeleted: false,
  deletedRevoked: false,
  ...overrides,
});

describe('classifyPortalMatch', () => {
  it('an active patient with portal access is a patient', () => {
    expect(classifyPortalMatch(match({ active: active() }))).toEqual({ kind: 'patient', patientId: 'p1' });
  });

  it('a soft-deleted twin does not hide the active patient', () => {
    expect(classifyPortalMatch(match({ active: active(), hasDeleted: true }))).toEqual({ kind: 'patient', patientId: 'p1' });
  });

  it('a revoked soft-deleted twin does not hide the active patient', () => {
    expect(classifyPortalMatch(match({ active: active(), hasDeleted: true, deletedRevoked: true })))
      .toEqual({ kind: 'patient', patientId: 'p1' });
  });

  it('revoked portal access is unavailable', () => {
    expect(classifyPortalMatch(match({ active: active({ portalAccessEnabled: false }) }))).toEqual({ kind: 'unavailable', review: false });
  });

  it('an INACTIVE patient is unavailable', () => {
    expect(classifyPortalMatch(match({ active: active({ status: PatientStatus.INACTIVE }) }))).toEqual({ kind: 'unavailable', review: true });
  });

  it('revoked access wins over INACTIVE: not reviewable', () => {
    expect(classifyPortalMatch(match({ active: active({ status: PatientStatus.INACTIVE, portalAccessEnabled: false }), hasDeleted: true })))
      .toEqual({ kind: 'unavailable', review: false });
  });

  it('only soft-deleted matches are unavailable', () => {
    expect(classifyPortalMatch(match({ hasDeleted: true }))).toEqual({ kind: 'unavailable', review: true });
  });

  it('a soft-deleted match whose access was revoked is not reviewable', () => {
    expect(classifyPortalMatch(match({ hasDeleted: true, deletedRevoked: true }))).toEqual({ kind: 'unavailable', review: false });
  });

  it('no match is none', () => {
    expect(classifyPortalMatch(match())).toEqual({ kind: 'none' });
  });
});
