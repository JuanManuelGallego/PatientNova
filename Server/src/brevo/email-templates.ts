/**
 * Spanish (es-CO) email templates for patient-facing transactional mail. Plain text only; the
 * client derives the HTML part. Templates never contain secrets in links: the confirmation points
 * to the portal appointments page, which requires an email OTP login.
 */
export interface RenderedEmail {
  subject: string;
  body: string;
}

export function renderOtpEmail(params: { code: string; providerName: string; ttlMinutes: number }): RenderedEmail {
  return {
    subject: 'Tu código de verificación',
    body: [
      'Hola,',
      '',
      `Tu código para continuar con tu cita con ${params.providerName} es:`,
      '',
      params.code,
      '',
      `Vence en ${params.ttlMinutes} minutos. Si no lo solicitaste, ignora este mensaje.`,
      'Nunca compartas este código con nadie.',
    ].join('\n'),
  };
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

export function renderBookingConfirmationEmail(params: PlaceParams & {
  providerName: string;
  whenLocal: string;
  timezone: string;
  appointmentsUrl: string;
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
      '',
      APPOINTMENTS_LINK_LINE,
      params.appointmentsUrl,
    ].join('\n'),
  };
}

export function renderPortalMeetingLinkEmail(params: {
  providerName: string;
  whenLocal: string;
  timezone: string;
  meetingUrl: string;
  appointmentsUrl: string;
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
      '',
      APPOINTMENTS_LINK_LINE,
      params.appointmentsUrl,
    ].join('\n'),
  };
}

const APPOINTMENTS_LINK_LINE = 'Puedes ver, cancelar o reprogramar tus citas aquí (te pediremos verificar tu correo):';

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
  appointmentsUrl: string;
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
      '',
      APPOINTMENTS_LINK_LINE,
      params.appointmentsUrl,
    ].join('\n'),
  };
}

export function renderBookingRequestReceivedEmail(params: { providerName: string; appointmentsUrl: string }): RenderedEmail {
  return {
    subject: `Recibimos tu solicitud de cita con ${params.providerName}`,
    body: [
      'Hola,',
      '',
      `Recibimos tu solicitud de cita con ${params.providerName}. Te avisaremos por correo cuando sea confirmada.`,
      '',
      `Puedes consultar su estado aquí: ${params.appointmentsUrl}`,
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
