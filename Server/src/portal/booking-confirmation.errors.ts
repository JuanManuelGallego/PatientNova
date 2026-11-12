import { ApiError } from '../utils/errors/errors.js';

export class WhatsAppUnavailableError extends ApiError {
  constructor() {
    super('Por ahora no podemos enviar mensajes por WhatsApp. Usa tu correo para reservar.', 409);
  }
}

export class BookingHoldCapacityError extends ApiError {
  constructor() {
    super('No hay cupo para nuevas reservas en este momento. Intenta de nuevo en un rato.', 429);
  }
}

export class ConfirmationLinkNotSentError extends ApiError {
  constructor() {
    super('No pudimos enviar el enlace de confirmación. Revisa el dato de contacto o inténtalo de nuevo en unos minutos.', 503);
  }
}

export class BookingReleaseNotFoundError extends ApiError {
  constructor() {
    super('Booking not found', 404);
  }
}

export class BookingConfirmationNotFoundError extends ApiError {
  constructor() {
    super('Este enlace no es válido.', 404);
  }
}
