import { Channel } from '../../generated/prisma/enums.js';
import { config } from '../utils/config/config.js';
import { formatDate, formatTime, formatWhen, MEETING_LINK_PENDING_TEXT } from '../appointments/appointment-reminder.renderer.js';
import {
  renderBookingConfirmationEmail,
  renderBookingRequestExpiredEmail,
  renderBookingRequestRejectedEmail,
  renderConfirmLinkEmail,
  renderUnconfirmedExpiredEmail,
  renderPortalCancellationEmail,
  renderPortalMeetingLinkEmail,
  renderPortalRescheduleEmail,
  type PlaceParams,
  type RenderedEmail,
} from '../brevo/email-templates.js';
import type { DispatchOpts } from '../scheduler/dispatch.js';
import type { PatientRoute } from './patient-route.js';

export interface ProviderContact {
  phone: string | null;
  whatsapp: string | null;
}

export const providerContactOf = (p: { publicPhone: string | null; publicWhatsapp: string | null }): ProviderContact => ({
  phone: p.publicPhone,
  whatsapp: p.publicWhatsapp,
});

export function confirmationUrl(token: string): string {
  return `${config.portal.url.replace(/\/+$/, '')}/book/confirmar/${token}`;
}

interface Timed {
  providerName: string;
  at: Date;
  timezone: string;
}

export interface PatientNoticeParams {
  confirmation: Timed & PlaceParams & { appointmentsUrl: string };
  cancellation: Timed & { bookingUrl: string };
  reschedule: Timed & PlaceParams & { previousAt: Date; appointmentsUrl: string };
  'meeting-link': Timed & { meetingUrl: string; appointmentsUrl: string };
  'request-rejected': Timed & { bookingUrl: string };
  'request-expired': Timed & { bookingUrl: string };
  'confirm-link': Timed & PlaceParams & { token: string; confirmUrl: string; approvalRequired: boolean; providerContact: ProviderContact };
  'unconfirmed-expired': Timed & { bookingUrl: string };
}

export type PatientNoticeKind = keyof PatientNoticeParams;

interface WhatsAppContent {
  contentSid: string;
  contentVariables: Record<string, string>;
}

interface NoticeTemplate<P> {
  email: (p: P) => RenderedEmail;
  whatsapp: (p: P) => WhatsAppContent;
  sms: (p: P) => string;
}

const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();

const emailTimes = (p: Timed) => ({
  providerName: p.providerName,
  whenLocal: formatWhen(p.at, p.timezone),
  timezone: p.timezone,
});

const slotVariables = (p: Timed) => ({
  '1': oneLine(p.providerName),
  '2': formatDate(p.at, p.timezone, true),
  '3': formatTime(p.at, p.timezone),
});

function placeText(p: PlaceParams): string {
  if (p.meetingUrl) return p.meetingUrl;
  if (p.meetingPending) return MEETING_LINK_PENDING_TEXT;
  return oneLine([ p.locationName, p.address ].filter(Boolean).join(', ')) || 'Por confirmar';
}

const NOTICES: { [K in PatientNoticeKind]: NoticeTemplate<PatientNoticeParams[K]> } = {
  confirmation: {
    email: (p) => renderBookingConfirmationEmail({ ...p, ...emailTimes(p) }),
    whatsapp: (p) => ({
      contentSid: config.twilio.patientPortal.confirmationSid,
      contentVariables: { ...slotVariables(p), '4': placeText(p) },
    }),
    sms: (p) => `Tu cita con ${p.providerName} quedó confirmada: ${formatWhen(p.at, p.timezone)} - Lugar: ${placeText(p)}`,
  },
  cancellation: {
    email: (p) => renderPortalCancellationEmail({ ...p, ...emailTimes(p) }),
    whatsapp: (p) => ({ contentSid: config.twilio.patientPortal.cancelSid, contentVariables: slotVariables(p) }),
    sms: (p) => `Tu cita con ${p.providerName} del ${formatWhen(p.at, p.timezone)} quedó cancelada.`,
  },
  reschedule: {
    email: (p) => renderPortalRescheduleEmail({ ...p, ...emailTimes(p), previousLocal: formatWhen(p.previousAt, p.timezone) }),
    whatsapp: (p) => ({
      contentSid: config.twilio.patientPortal.rescheduleSid,
      contentVariables: {
        '1': oneLine(p.providerName),
        '2': formatWhen(p.previousAt, p.timezone),
        '3': formatDate(p.at, p.timezone, true),
        '4': formatTime(p.at, p.timezone),
        '5': placeText(p),
      },
    }),
    sms: (p) => `Tu cita con ${p.providerName} pasó del ${formatWhen(p.previousAt, p.timezone)} al ${formatWhen(p.at, p.timezone)} - Lugar: ${placeText(p)}`,
  },
  'meeting-link': {
    email: (p) => renderPortalMeetingLinkEmail({ ...p, ...emailTimes(p) }),
    whatsapp: (p) => ({
      contentSid: config.twilio.appointmentMeetingLinkSid,
      contentVariables: { '1': oneLine(p.providerName), '2': p.meetingUrl },
    }),
    sms: (p) => `Enlace de tu cita con ${p.providerName} del ${formatWhen(p.at, p.timezone)}: ${p.meetingUrl}`,
  },
  'request-rejected': {
    email: (p) => renderBookingRequestRejectedEmail({ ...p, ...emailTimes(p) }),
    whatsapp: (p) => ({ contentSid: config.twilio.patientPortal.requestRejectedSid, contentVariables: slotVariables(p) }),
    sms: (p) => `Tu solicitud de cita con ${p.providerName} para el ${formatWhen(p.at, p.timezone)} no fue confirmada.`,
  },
  'request-expired': {
    email: (p) => renderBookingRequestExpiredEmail({ ...p, ...emailTimes(p) }),
    whatsapp: (p) => ({ contentSid: config.twilio.patientPortal.requestExpiredSid, contentVariables: slotVariables(p) }),
    sms: (p) => `Tu solicitud de cita con ${p.providerName} para el ${formatWhen(p.at, p.timezone)} venció sin ser confirmada.`,
  },
  'confirm-link': {
    email: (p) => renderConfirmLinkEmail({ ...p, ...emailTimes(p) }),
    whatsapp: (p) => ({
      contentSid: config.twilio.patientPortal.confirmLinkSid,
      contentVariables: { ...slotVariables(p), '4': p.token },
    }),
    sms: (p) => p.approvalRequired
      ? `Tu solicitud de cita con ${p.providerName} del ${formatWhen(p.at, p.timezone)} todavía no se ha enviado. Confírmala en los próximos 15 minutos: ${p.confirmUrl}`
      : `Tu cita con ${p.providerName} del ${formatWhen(p.at, p.timezone)} todavía no está confirmada. Confírmala en los próximos 15 minutos: ${p.confirmUrl}`,
  },
  'unconfirmed-expired': {    email: (p) => renderUnconfirmedExpiredEmail({ ...p, ...emailTimes(p) }),
    whatsapp: (p) => ({
      contentSid: config.twilio.patientPortal.unconfirmedExpiredSid,
      contentVariables: slotVariables(p),
    }),
    sms: (p) => `No confirmaste tu cita con ${p.providerName} del ${formatWhen(p.at, p.timezone)}, así que el horario quedó libre. Puedes reservar de nuevo: ${p.bookingUrl}`,
  },
};

export function renderPatientNotice<K extends PatientNoticeKind>(kind: K, params: PatientNoticeParams[K], route: PatientRoute): DispatchOpts {
  const notice = NOTICES[kind];
  switch (route.channel) {
    case Channel.WHATSAPP:
      return { to: route.to, ...notice.whatsapp(params) };
    case Channel.SMS:
      return { to: route.to, body: notice.sms(params) };
    case Channel.EMAIL:
      return { to: route.to, ...notice.email(params) };
  }
}
