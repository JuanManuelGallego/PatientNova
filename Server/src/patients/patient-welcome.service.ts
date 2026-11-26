import { ActionType, Channel, EntityType } from '../../generated/prisma/enums.ts';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { consentDocumentUrl } from '../consent-documents/consent-document-url.js';
import { patientTypeRepository } from '../patient-types/patient-type.repository.js';
import { patientRouteSelect, resolvePatientRoute } from '../portal/patient-route.js';
import { sendNow, type ImmediateMessage } from '../twilio/send-now.js';
import { WHATSAPP_TEMPLATES } from '../twilio/whatsapp-templates.js';
import { logger } from '../utils/api/logger.js';
import { PatientNotFoundError } from '../utils/errors/errors.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { WelcomeConsentMissingError, WelcomeNoContactError, WelcomeProviderDataMissingError } from './patient.errors.js';

/**
 * The approved WhatsApp template's text, for email and SMS. WhatsApp carries the PDF in the template itself; here the
 * consent link ({{9}}) is written into the text.
 */
const WELCOME_TEXT = '¡Hola {{1}}! Te damos la bienvenida a Patient Nova, la plataforma de recordatorios de citas de {{2}}. '
  + 'A través de este canal, podrás confirmar o cancelar tus próximas citas de forma rápida. Te recordamos que el pago '
  + 'de la consulta se realiza antes de asistir a tu cita. Banco: {{3}} Número de cuenta: {{4}} A nombre de: {{5}} '
  + 'Cédula: {{6}} Llave: {{7}} Por favor, descarga y completa el documento de consentimiento antes de tu primera '
  + 'consulta: {{9}} ¡Muchas gracias!';

function render(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\d+)\}\}/g, (match, key: string) => variables[ key ] ?? match);
}

export interface WelcomeResult {
  reminderId: string;
  channel: Channel;
  consentVersionId: string;
}

/**
 * Sends the welcome message on the patient's route, linking the current consent version of the patient's type
 * (`{{8}}`), and audits which version was sent. Refuses (409) before sending when the provider's display name or
 * banking details are missing, the type has no consent PDF, or the patient has no reachable contact.
 */
export async function sendPatientWelcome(userId: string, patientId: string): Promise<WelcomeResult> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId, isDeleted: false },
    select: { ...patientRouteSelect, name: true, patientTypeId: true },
  });
  if (!patient) throw new PatientNotFoundError(patientId);

  const provider = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { displayName: true, firstName: true, lastName: true, bankName: true, accountNumber: true, nationalId: true, bankingKey: true },
  });
  const { displayName, bankName, accountNumber, nationalId, bankingKey } = provider;
  if (!displayName || !bankName || !accountNumber || !nationalId || !bankingKey) throw new WelcomeProviderDataMissingError();

  const version = await patientTypeRepository.currentVersion(patient.patientTypeId);
  if (!version) throw new WelcomeConsentMissingError();

  const route = resolvePatientRoute(patient);
  if (!route) throw new WelcomeNoContactError();

  // A template variable is never empty: the account holder falls back to the display name.
  const holder = [ provider.firstName, provider.lastName ].filter(Boolean).join(' ') || displayName;
  const variables: Record<string, string> = {
    '1': patient.name,
    '2': displayName,
    '3': bankName,
    '4': accountNumber,
    '5': holder,
    '6': nationalId,
    '7': bankingKey,
    '8': version.id,
  };
  const message: ImmediateMessage = route.channel === Channel.WHATSAPP
    ? { channel: Channel.WHATSAPP, to: route.to, contentSid: WHATSAPP_TEMPLATES.patientWelcomeSid, contentVariables: variables, patientId }
    : { channel: route.channel, to: route.to, body: render(WELCOME_TEXT, { ...variables, '9': consentDocumentUrl(version) }), patientId };

  const { reminderId } = await sendNow(message, userId);

  // Best effort: the message has already left, so a failed audit write must not turn the send into an error.
  await logAudit({
    entityType: EntityType.CONSENT_DOCUMENT,
    entityId: version.id,
    userId,
    actionType: ActionType.SEND,
    description: `Formulario de consentimiento v${version.version} enviado en el mensaje de bienvenida`,
    affectedFields: [],
    fieldsAfter: { patientId, reminderId, patientTypeId: patient.patientTypeId, version: version.version, channel: route.channel },
  });
  logger.info({ userId, patientId, reminderId, consentVersion: version.version }, 'Welcome message sent');
  return { reminderId, channel: route.channel, consentVersionId: version.id };
}
