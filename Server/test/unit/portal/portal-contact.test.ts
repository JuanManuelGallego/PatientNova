import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Channel } from '../../../generated/prisma/enums.js';
import { config } from '../../../src/utils/config/config.js';
import { portalActorId, portalPatientAuditContext } from '../../../src/audit-log/audit-actors.js';
import { emailHash, phoneHash, portalActorHash } from '../../../src/utils/encryption/blind-index.js';
import {
  contactClaims,
  contactFromClaims,
  contactHashOf,
  emailContact,
  isPhoneContact,
  maskContact,
  ownRequestWhere,
} from '../../../src/portal/portal-contact.js';

const PHONE = '+573001112233';
const whatsapp = { channel: Channel.WHATSAPP, value: PHONE };
const sms = { channel: Channel.SMS, value: PHONE };

describe('contactHashOf', () => {
  it('hashes an email the same way the patient and the request do', () => {
    expect(contactHashOf(emailContact(' Ana@Example.COM '))).toBe(emailHash('ana@example.com'));
  });

  it('gives WhatsApp and SMS the same hash, so one number has one contact hash', () => {
    expect(contactHashOf(whatsapp)).toBe(phoneHash(PHONE));
    expect(contactHashOf(sms)).toBe(contactHashOf(whatsapp));
  });
});

describe('ownRequestWhere', () => {
  it('matches an email session on the email blind index', () => {
    expect(ownRequestWhere(emailContact('ana@example.com'))).toEqual({ emailHash: emailHash('ana@example.com') });
  });

  it('matches a phone session on the proven number only, never on the typed `phone`', () => {
    expect(ownRequestWhere(whatsapp)).toEqual({ verifiedPhoneHash: phoneHash(PHONE) });
    expect(Object.keys(ownRequestWhere(sms)!)).toEqual([ 'verifiedPhoneHash' ]);
  });
});

describe('maskContact', () => {
  it('masks each kind of contact', () => {
    expect(maskContact(emailContact('ana@example.com'))).toBe('a***@example.com');
    expect(maskContact(whatsapp)).toBe('***2233');
  });
});

describe('token claims', () => {
  it('round-trips each kind of contact with exactly one contact claim', () => {
    expect(contactClaims(emailContact('ana@example.com'))).toEqual({ channel: Channel.EMAIL, email: 'ana@example.com' });
    expect(contactClaims(whatsapp)).toEqual({ channel: Channel.WHATSAPP, phone: PHONE });
    expect(contactFromClaims({ ...contactClaims(sms) })).toEqual(sms);
    expect(contactFromClaims({ ...contactClaims(whatsapp) })).toEqual(whatsapp);
  });

  it('reads a token issued before phone login, with only `email`, as an email session', () => {
    expect(contactFromClaims({ email: 'ana@example.com' })).toEqual({ channel: Channel.EMAIL, value: 'ana@example.com' });
  });

  it.each([
    [ 'no contact', {} ],
    [ 'both contacts', { email: 'a@b.co', phone: PHONE, channel: Channel.WHATSAPP } ],
    [ 'an empty email', { email: '' } ],
    [ 'a phone with no channel', { phone: PHONE } ],
    [ 'a phone on the email channel', { phone: PHONE, channel: Channel.EMAIL } ],
    [ 'an email on a phone channel', { email: 'a@b.co', channel: Channel.SMS } ],
    [ 'an unknown channel', { phone: PHONE, channel: 'PIGEON' } ],
    [ 'a non-string email', { email: 42 } ],
  ])('rejects %s', (_name, claims) => {
    expect(contactFromClaims(claims)).toBeNull();
  });
});

describe('portal actor', () => {
  const expectedEmailHash = (userId: string, email: string) => createHmac('sha256', Buffer.from(config.encryption.blindIndexKey, 'hex'))
    .update(`portal-actor:${userId}:${email}`)
    .digest('hex');

  it('keeps the email form byte-identical, or audit rows already written stop matching', () => {
    expect(portalActorHash('user-1', ' Ana@Example.com ')).toBe(expectedEmailHash('user-1', 'ana@example.com'));
    expect(portalActorId('user-1', 'ana@example.com')).toBe(`portal:${expectedEmailHash('user-1', 'ana@example.com').slice(0, 24)}`);
  });

  it('gives one actor to a number, whatever the channel or the format it was stored in', () => {
    expect(portalActorId('user-1', '+57 300 111 2233')).toBe(portalActorId('user-1', PHONE));
    expect(portalPatientAuditContext({ userId: 'user-1', contact: whatsapp }).actorId)
      .toBe(portalPatientAuditContext({ userId: 'user-1', contact: sms }).actorId);
  });

  it('is scoped per provider', () => {
    expect(portalActorId('user-1', PHONE)).not.toBe(portalActorId('user-2', PHONE));
  });

  it('never shows the full number in the audit row', () => {
    const ctx = portalPatientAuditContext({ userId: 'user-1', contact: whatsapp });
    expect(ctx.actorDisplayName).toBe('Paciente (portal) ***2233');
    expect(isPhoneContact(whatsapp)).toBe(true);
  });
});
