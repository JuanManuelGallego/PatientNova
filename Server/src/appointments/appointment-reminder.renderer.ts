import { Channel } from '../../generated/prisma/client.ts';
import { BULK_TEMPLATE_CONFIG } from '../twilio/bulk-template-config.ts';
import { DEFAULT_LOCALE } from '../utils/config/constants.ts';
import type { AppointmentWithRelations } from './appointment.types.ts';

const PRESENTIAL_KEY = 'PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_PRESENTIAL';
const VIRTUAL_KEY = 'PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_VIRTUAL';

const PRESENTIAL_TEMPLATE = `Asunto: Recordatorio de cita

Buen día {{1}}, espero que se encuentre muy bien.

Le escribimos para recordarle su próxima cita presencial con {{2}}:

Fecha: {{3}}

Hora: {{4}}

Dirección: {{5}}

Instrucciones: {{6}}

Le recordamos cordialmente que el pago de la consulta debe estar gestionado y confirmado antes del inicio de la sesión.

Quedamos a su disposición para cualquier duda. ¡Feliz día!`;

const VIRTUAL_TEMPLATE = `Asunto: Recordatorio de cita

Buen día {{1}}, espero que se encuentre muy bien.

Le escribimos para recordarle su próxima cita virtual con {{2}}:

Fecha: {{3}}

Hora: {{4}}

Enlace de la reunión: {{5}}

Le recordamos cordialmente que el pago de la consulta debe estar gestionado y confirmado antes del inicio de la sesión.

Quedamos a su disposición para cualquier duda. ¡Feliz día!`;

export function renderAppointmentReminder(
  appointment: AppointmentWithRelations,
  doctorName: string,
): { contentSid: string | null; contentVariables: Record<string, string>; body: string | null } | null {
  const reminder = appointment.reminder;
  if (!reminder) return null;

  const date = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: appointment.timezone,
  }).format(appointment.startAt);
  const time = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: appointment.timezone,
  }).format(appointment.startAt);
  const isVirtual = appointment.appointmentLocation?.isVirtual ?? false;
  const variables: Record<string, string> = {
    '1': appointment.patient.name,
    '2': doctorName,
    '3': date,
    '4': time,
    '5': isVirtual
      ? appointment.meetingUrl!
      : appointment.appointmentLocation?.address || 'No hay dirección registrada',
    ...(!isVirtual && {
      '6': appointment.appointmentLocation?.instructions || 'No hay instrucciones registradas',
    }),
  };

  if (reminder.channel === Channel.WHATSAPP) {
    return {
      contentSid: BULK_TEMPLATE_CONFIG[isVirtual ? VIRTUAL_KEY : PRESENTIAL_KEY]!.contentSid,
      contentVariables: variables,
      body: null,
    };
  }

  const template = isVirtual ? VIRTUAL_TEMPLATE : PRESENTIAL_TEMPLATE;
  return {
    contentSid: null,
    contentVariables: variables,
    body: template.replace(/\{\{(\d+)\}\}/g, (match, key: string) => variables[key] ?? match),
  };
}
