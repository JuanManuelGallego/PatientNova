import { describe, expect, it } from 'vitest';
import { PatientStatus } from '../../../generated/prisma/enums.js';
import { classifyPhoneMatch, classifyPortalMatch, isTrustedPhoneMatch } from '../../../src/portal/patient-resolution.js';

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

describe('classifyPhoneMatch', () => {
  const HASH = 'number-hash';
  const row = (overrides: Partial<Parameters<typeof classifyPhoneMatch>[0][number]> = {}) => ({
    id: 'p1',
    status: PatientStatus.ACTIVE,
    portalAccessEnabled: true,
    isDeleted: false,
    whatsappHash: HASH,
    smsHash: null,
    whatsappUnverified: false,
    ...overrides,
  });

  it('no record is none', () => {
    expect(classifyPhoneMatch([], HASH)).toEqual({ kind: 'none' });
  });

  it('one trusted record is that patient', () => {
    expect(classifyPhoneMatch([ row() ], HASH)).toEqual({ kind: 'patient', patientId: 'p1' });
  });

  it('counts only trusted records, so a typed number cannot block the real holder', () => {
    const typed = row({ id: 'typed', whatsappUnverified: true });
    expect(classifyPhoneMatch([ typed, row() ], HASH)).toEqual({ kind: 'patient', patientId: 'p1' });
  });

  it('two trusted records never auto-pick', () => {
    expect(classifyPhoneMatch([ row(), row({ id: 'p2' }) ], HASH)).toEqual({ kind: 'unavailable', review: true });
  });

  it('only unverified records go to review', () => {
    expect(classifyPhoneMatch([ row({ whatsappUnverified: true }) ], HASH)).toEqual({ kind: 'unavailable', review: true });
  });

  it('a revoked record fails closed for the whole number, even an unverified one', () => {
    expect(classifyPhoneMatch([ row(), row({ id: 'p2', portalAccessEnabled: false }) ], HASH)).toEqual({ kind: 'unavailable', review: false });
    expect(classifyPhoneMatch([ row(), row({ id: 'p2', whatsappUnverified: true, portalAccessEnabled: false }) ], HASH))
      .toEqual({ kind: 'unavailable', review: false });
  });

  it('a deleted record alone is reviewable unless its access was revoked', () => {
    expect(classifyPhoneMatch([ row({ isDeleted: true }) ], HASH)).toEqual({ kind: 'unavailable', review: true });
    expect(classifyPhoneMatch([ row({ isDeleted: true, portalAccessEnabled: false }) ], HASH)).toEqual({ kind: 'unavailable', review: false });
  });

  it('a deleted record does not hide the trusted active one', () => {
    expect(classifyPhoneMatch([ row({ id: 'gone', isDeleted: true }), row() ], HASH)).toEqual({ kind: 'patient', patientId: 'p1' });
  });

  it('an inactive trusted record is reviewable', () => {
    expect(classifyPhoneMatch([ row({ status: PatientStatus.INACTIVE }) ], HASH)).toEqual({ kind: 'unavailable', review: true });
  });
});

describe('isTrustedPhoneMatch', () => {
  it('trusts an SMS number whatever the WhatsApp flag says, since only the provider writes it', () => {
    expect(isTrustedPhoneMatch({ smsHash: 'h', whatsappHash: 'other', whatsappUnverified: true }, 'h')).toBe(true);
  });

  it('trusts a WhatsApp number only when it is not flagged', () => {
    expect(isTrustedPhoneMatch({ smsHash: null, whatsappHash: 'h', whatsappUnverified: false }, 'h')).toBe(true);
    expect(isTrustedPhoneMatch({ smsHash: null, whatsappHash: 'h', whatsappUnverified: true }, 'h')).toBe(false);
  });

  it('never trusts a record that does not hold the number', () => {
    expect(isTrustedPhoneMatch({ smsHash: 'a', whatsappHash: 'b', whatsappUnverified: false }, 'h')).toBe(false);
  });
});
