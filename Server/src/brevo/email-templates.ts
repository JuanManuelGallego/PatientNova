/**
 * Spanish (es-CO) email templates for patient-facing transactional mail. Plain text only; the
 * client derives the HTML part. The confirmation-link email is the only one whose link carries a
 * secret (the booking token in `confirmUrl`); every other link is public.
 */
export interface RenderedEmail {
  subject: string;
  body: string;
}

export interface PlaceParams {
  locationName?: string | null;
  address?: string | null;
  meetingUrl?: string | null;
  meetingPending?: boolean;
}

export const MEETING_LINK_PENDING_LINE = 'Te enviaremos el enlace de la videollamada en un correo aparte.';

function placeLines(p: PlaceParams): string[] {
  return [
    ...(p.locationName ? [ `Lugar: ${p.locationName}` ] : []),
    ...(p.address ? [ `Dirección: ${p.address}` ] : []),
    ...(p.meetingUrl ? [ `Enlace de la videollamada: ${p.meetingUrl}` ] : []),
    ...(p.meetingPending && !p.meetingUrl ? [ MEETING_LINK_PENDING_LINE ] : []),
  ];
}

export interface EmailProviderContact {
  phone: string | null;
  whatsapp: string | null;
}

function contactProviderLine(providerName: string, contact?: EmailProviderContact): string[] {
  if (!contact) return [];
  const parts = [ contact.phone, contact.whatsapp ? `WhatsApp ${contact.whatsapp}` : null ].filter(Boolean);
  if (parts.length === 0) return [];
  return [ `Para cancelar o cambiar tu cita, comunícate directamente con ${providerName}: ${parts.join(' o ')}` ];
}

function appointmentsLines(appointmentsUrl?: string): string[] {
  return appointmentsUrl ? [ '', APPOINTMENTS_LINK_LINE, appointmentsUrl ] : [];
}

function contactBlock(providerName: string, contact?: EmailProviderContact): string[] {
  const line = contactProviderLine(providerName, contact);
  return line.length ? [ '', ...line ] : [];
}

export function renderBookingConfirmationEmail(params: PlaceParams & {
  providerName: string;
  whenLocal: string;
  timezone: string;
  appointmentsUrl?: string;
  providerContact?: EmailProviderContact;
}): RenderedEmail {
  return {
    subject: `Cita confirmada con ${params.providerName}`,
    body: [
      'Hola,',
      '',
      `Tu cita con ${params.providerName} quedó confirmada.`,
      '',
      `Fecha y hora: ${params.whenLocal} (hora de ${params.timezone})`,
      ...placeLines(params),
      ...contactBlock(params.providerName, params.providerContact),
      ...appointmentsLines(params.appointmentsUrl),
    ].join('\n'),
  };
}

export function renderPortalMeetingLinkEmail(params: {
  providerName: string;
  whenLocal: string;
  timezone: string;
  meetingUrl: string;
  appointmentsUrl?: string;
  providerContact?: EmailProviderContact;
}): RenderedEmail {
  return {
    subject: `Enlace de tu videollamada con ${params.providerName}`,
    body: [
      'Hola,',
      '',
      `Ya está listo el enlace de tu cita virtual con ${params.providerName}.`,
      '',
      `Fecha y hora: ${params.whenLocal} (hora de ${params.timezone})`,
      `Enlace de la videollamada: ${params.meetingUrl}`,
      ...contactBlock(params.providerName, params.providerContact),
      ...appointmentsLines(params.appointmentsUrl),
    ].join('\n'),
  };
}

const APPOINTMENTS_LINK_LINE = 'Puedes ver, cancelar o reprogramar tus citas aquí:';

/** Patient confirmation of a cancellation made in the portal. `whenLocal` is in the patient's zone. */
export function renderPortalCancellationEmail(params: {
  providerName: string;
  whenLocal: string;
  timezone: string;
  bookingUrl: string;
}): RenderedEmail {
  return {
    subject: `Cita cancelada con ${params.providerName}`,
    body: [
      'Hola,',
      '',
      `Tu cita con ${params.providerName} del ${params.whenLocal} (hora de ${params.timezone}) quedó cancelada.`,
      '',
      'Si quieres, puedes reservar una nueva cita aquí:',
      params.bookingUrl,
    ].join('\n'),
  };
}

/** Patient confirmation of a reschedule made in the portal. Both times are in the patient's zone. */
export function renderPortalRescheduleEmail(params: PlaceParams & {
  providerName: string;
  whenLocal: string;
  previousLocal: string;
  timezone: string;
  appointmentsUrl?: string;
  providerContact?: EmailProviderContact;
}): RenderedEmail {
  return {
    subject: `Cita reprogramada con ${params.providerName}`,
    body: [
      'Hola,',
      '',
      `Tu cita con ${params.providerName} quedó reprogramada.`,
      '',
      `Nueva fecha y hora: ${params.whenLocal} (hora de ${params.timezone})`,
      `Fecha anterior: ${params.previousLocal}`,
      ...placeLines(params),
      ...contactBlock(params.providerName, params.providerContact),
      ...appointmentsLines(params.appointmentsUrl),
    ].join('\n'),
  };
}

const ANOTHER_TIME_LINE = 'Si quieres, puedes solicitar otro horario aquí:';

/** Neutral by design: the patient never learns why the provider did not confirm. */
export function renderBookingRequestRejectedEmail(params: {
  providerName: string;
  whenLocal: string;
  timezone: string;
  bookingUrl: string;
}): RenderedEmail {
  return {
    subject: `Tu solicitud de cita con ${params.providerName} no fue confirmada`,
    body: [
      'Hola,',
      '',
      `${params.providerName} no pudo confirmar tu solicitud de cita del ${params.whenLocal} (hora de ${params.timezone}).`,
      '',
      ANOTHER_TIME_LINE,
      params.bookingUrl,
    ].join('\n'),
  };
}

export function renderBookingRequestExpiredEmail(params: {
  providerName: string;
  whenLocal: string;
  timezone: string;
  bookingUrl: string;
}): RenderedEmail {
  return {
    subject: `Tu solicitud de cita con ${params.providerName} venció`,
    body: [
      'Hola,',
      '',
      `Tu solicitud de cita con ${params.providerName} del ${params.whenLocal} (hora de ${params.timezone}) venció sin ser confirmada.`,
      '',
      ANOTHER_TIME_LINE,
      params.bookingUrl,
    ].join('\n'),
  };
}

export const CONFIRM_LINK_MINUTES = 15;

export function renderConfirmLinkEmail(params: {
  providerName: string;
  whenLocal: string;
  timezone: string;
  locationName?: string | null;
  address?: string | null;
  confirmUrl: string;
  approvalRequired: boolean;
  providerContact?: EmailProviderContact;
}): RenderedEmail {
  const when = `${params.whenLocal} (hora de ${params.timezone})`;
  const lead = params.approvalRequired
    ? `Tu solicitud de cita del ${when} todavía no se ha enviado. Confírmala en los próximos ${CONFIRM_LINK_MINUTES} minutos con este enlace; si no, el horario quedará libre.`
    : `Tu cita del ${when} todavía no está confirmada. Confírmala en los próximos ${CONFIRM_LINK_MINUTES} minutos con este enlace; si no, el horario quedará libre.`;
  return {
    subject: params.approvalRequired
      ? `Confirma tu solicitud de cita con ${params.providerName}`
      : `Confirma tu cita con ${params.providerName}`,
    body: [
      'Hola,',
      '',
      lead,
      '',
      params.confirmUrl,
      ...(params.locationName || params.address ? [ '' ] : []),
      ...placeLines({ ...(params.locationName && { locationName: params.locationName }), ...(params.address && { address: params.address }) }),
      ...contactBlock(params.providerName, params.providerContact),
      '',
      'Si no hiciste esta reserva, ignora este mensaje.',
    ].join('\n'),
  };
}

export function renderUnconfirmedExpiredEmail(params: {
  providerName: string;
  whenLocal: string;
  bookingUrl: string;
}): RenderedEmail {
  return {
    subject: `Tu reserva con ${params.providerName} no se confirmó`,
    body: [
      'Hola,',
      '',
      `No confirmaste tu cita del ${params.whenLocal}, así que el horario quedó libre. Puedes reservar de nuevo aquí: ${params.bookingUrl}`,
    ].join('\n'),
  };
}
