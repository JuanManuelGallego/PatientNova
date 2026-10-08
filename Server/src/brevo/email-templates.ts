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
    subject: `Tu código de verificación: ${params.code}`,
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

export function renderBookingConfirmationEmail(params: {
  providerName: string;
  /** Already formatted in the provider's timezone, e.g. "martes 20 de octubre de 2026, 10:30". */
  whenLocal: string;
  locationName?: string | null;
  appointmentsUrl: string;
}): RenderedEmail {
  return {
    subject: `Cita confirmada con ${params.providerName}`,
    body: [
      'Hola,',
      '',
      `Tu cita con ${params.providerName} quedó confirmada.`,
      '',
      `Fecha y hora: ${params.whenLocal}`,
      ...(params.locationName ? [ `Lugar: ${params.locationName}` ] : []),
      '',
      'Puedes ver, cancelar o reprogramar tu cita aquí (te pediremos verificar tu correo):',
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
