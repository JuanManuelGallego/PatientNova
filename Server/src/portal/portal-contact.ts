import { Channel } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { maskEmail, maskPhone } from '../utils/api/logger.js';
import { emailHash, phoneHash } from '../utils/encryption/blind-index.js';
import { normalizeEmail } from '../utils/validation/normalize-email.js';
import type { PortalTokenClaims } from '../auth/tokens.js';

/** What a portal session proved control of. WhatsApp and SMS prove the same number. */
export interface PortalContact {
  channel: Channel;
  value: string;
}

export const emailContact = (email: string): PortalContact => ({ channel: Channel.EMAIL, value: normalizeEmail(email) });

export const isPhoneContact = (contact: PortalContact): boolean => contact.channel !== Channel.EMAIL;

/** What a patient may log in with. */
export function portalLoginChannels(): Channel[] {
  return [ Channel.EMAIL, Channel.WHATSAPP, Channel.SMS ];
}


export function contactHashOf(contact: PortalContact): string | null {
  return isPhoneContact(contact) ? phoneHash(contact.value) : emailHash(contact.value);
}

export function maskContact(contact: PortalContact): string {
  return isPhoneContact(contact) ? maskPhone(contact.value) : maskEmail(contact.value);
}

/**
 * The session's own booking requests. A phone session matches only the number it proved: the `phone` typed in a booking
 * form is never queried, because anyone can type someone else's number.
 */
export function ownRequestWhere(contact: PortalContact): Prisma.BookingRequestWhereInput | null {
  const hash = contactHashOf(contact);
  if (!hash) return null;
  return isPhoneContact(contact) ? { verifiedPhoneHash: hash } : { emailHash: hash };
}

/** The contact a booking request proved. Null only for a row that broke the rule that exactly one is set. */
export function requestContact(request: { contactChannel: Channel; email: string | null; verifiedPhone: string | null }): PortalContact | null {
  const value = request.contactChannel === Channel.EMAIL ? request.email : request.verifiedPhone;
  return value ? { channel: request.contactChannel, value } : null;
}

/** The contact a new patient starts with: a proven number on its own channel, or the email plus a typed, unproven number. */
export function newPatientContact(contact: PortalContact, typedPhone: string | null | undefined) {
  switch (contact.channel) {
    case Channel.WHATSAPP:
      return { whatsappNumber: contact.value, reminderChannel: Channel.WHATSAPP };
    case Channel.SMS:
      return { smsNumber: contact.value, reminderChannel: Channel.SMS };
    case Channel.EMAIL:
      return { email: contact.value, whatsappNumber: typedPhone || null, reminderChannel: Channel.EMAIL };
  }
}

export const typedPhoneIsUnverified = (contact: PortalContact, typedPhone: string | null | undefined): boolean =>
  !isPhoneContact(contact) && !!typedPhone;

/** `email` stays until every deployed Portal reads `contact`; it is null for a phone session. */
export function sessionContactView(contact: PortalContact) {
  return {
    email: isPhoneContact(contact) ? null : contact.value,
    contact: contact.value,
    contactChannel: contact.channel,
  };
}

export function contactClaims(contact: PortalContact): Pick<PortalTokenClaims, 'channel' | 'email' | 'phone'> {
  return isPhoneContact(contact)
    ? { channel: contact.channel, phone: contact.value }
    : { channel: contact.channel, email: contact.value };
}

const isFilled = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Exactly one contact, matching its channel. A token issued before phone login has only `email`: it reads as EMAIL. */
export function contactFromClaims(claims: Record<string, unknown>): PortalContact | null {
  const { channel, email, phone } = claims;
  if (isFilled(email) === isFilled(phone)) return null;
  if (isFilled(email)) return channel === undefined || channel === Channel.EMAIL ? emailContact(email) : null;
  return channel === Channel.WHATSAPP || channel === Channel.SMS ? { channel, value: phone as string } : null;
}
