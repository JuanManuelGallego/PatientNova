import { Channel } from '../../generated/prisma/enums.js';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';

export interface PatientRoute {
  channel: Channel;
  to: string;
}

export const patientRouteSelect = {
  reminderChannel: true,
  email: true,
  whatsappNumber: true,
  whatsappUnverified: true,
  smsNumber: true,
} as const;

export interface PatientRouteFields {
  reminderChannel: Channel;
  email: string | null;
  whatsappNumber: string | null;
  whatsappUnverified: boolean;
  smsNumber: string | null;
}

const FALLBACK_ORDER = [ Channel.EMAIL, Channel.WHATSAPP, Channel.SMS ];

function addressFor(patient: PatientRouteFields, channel: Channel): string | null {
  switch (channel) {
    case Channel.EMAIL:
      return patient.email;
    case Channel.WHATSAPP:
      return patient.whatsappUnverified ? null : patient.whatsappNumber;
    case Channel.SMS:
      return patient.smsNumber;
  }
}

/**
 * The one route for every patient message: `reminderChannel` when it has an address, else email, WhatsApp, SMS. A number
 * typed in the booking form is never messaged until the provider endorses it. Null: nowhere to send, so callers skip.
 */
export function resolvePatientRoute(patient: PatientRouteFields): PatientRoute | null {
  for (const channel of [ patient.reminderChannel, ...FALLBACK_ORDER ]) {
    const to = addressFor(patient, channel);
    if (to) return { channel, to };
  }
  return null;
}

export async function loadPatientRoute(userId: string, patientId: string, tx: TransactionClient): Promise<PatientRoute | null> {
  const patient = await tx.patient.findFirstOrThrow({ where: { id: patientId, userId }, select: patientRouteSelect });
  return resolvePatientRoute(patient);
}
