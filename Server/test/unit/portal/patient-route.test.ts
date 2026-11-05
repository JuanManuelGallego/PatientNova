import { describe, expect, it } from 'vitest';
import { Channel } from '../../../generated/prisma/enums.js';
import { resolvePatientRoute, type PatientRouteFields } from '../../../src/portal/patient-route.js';

const EMAIL = 'ana@example.com';
const WHATSAPP = '+573001112233';
const SMS = '+573004445566';

function patient(overrides: Partial<PatientRouteFields> = {}): PatientRouteFields {
  return { reminderChannel: Channel.EMAIL, email: EMAIL, whatsappNumber: WHATSAPP, whatsappUnverified: false, smsNumber: SMS, ...overrides };
}

describe('resolvePatientRoute', () => {
  it.each([
    [ Channel.EMAIL, EMAIL ],
    [ Channel.WHATSAPP, WHATSAPP ],
    [ Channel.SMS, SMS ],
  ])('follows reminderChannel %s when it has an address', (reminderChannel, to) => {
    expect(resolvePatientRoute(patient({ reminderChannel }))).toEqual({ channel: reminderChannel, to });
  });

  it('falls back to email, then WhatsApp, then SMS', () => {
    expect(resolvePatientRoute(patient({ reminderChannel: Channel.SMS, smsNumber: null })))
      .toEqual({ channel: Channel.EMAIL, to: EMAIL });
    expect(resolvePatientRoute(patient({ reminderChannel: Channel.SMS, smsNumber: null, email: null })))
      .toEqual({ channel: Channel.WHATSAPP, to: WHATSAPP });
    expect(resolvePatientRoute(patient({ reminderChannel: Channel.WHATSAPP, whatsappNumber: null, email: null })))
      .toEqual({ channel: Channel.SMS, to: SMS });
  });

  it('never routes to an unverified WhatsApp number, even when it is the reminder channel', () => {
    expect(resolvePatientRoute(patient({ reminderChannel: Channel.WHATSAPP, whatsappUnverified: true })))
      .toEqual({ channel: Channel.EMAIL, to: EMAIL });
    expect(resolvePatientRoute(patient({ email: null, whatsappUnverified: true })))
      .toEqual({ channel: Channel.SMS, to: SMS });
    expect(resolvePatientRoute(patient({ email: null, smsNumber: null, whatsappUnverified: true }))).toBeNull();
  });

  it('returns null when the patient has no usable address', () => {
    expect(resolvePatientRoute(patient({ email: null, whatsappNumber: null, smsNumber: null }))).toBeNull();
  });
});
