import { ApiError } from '../utils/errors/errors.js';

export class PatientEmailConflictError extends ApiError {
  constructor() {
    super('A patient with this email already exists', 409)
  }
}

export class PatientLimitReachedError extends ApiError {
  constructor(limit: number) {
    super(`Patient limit reached (${limit} per provider)`, 409)
  }
}

export class WelcomeProviderDataMissingError extends ApiError {
  constructor() {
    super('Completa tu nombre visible y tus datos bancarios en Configuración para enviar el mensaje de bienvenida', 409)
  }
}

export class WelcomeConsentMissingError extends ApiError {
  constructor() {
    super('El tipo de este paciente no tiene formulario de consentimiento. Súbelo en Configuración para enviar el mensaje de bienvenida', 409)
  }
}

export class WelcomeNoContactError extends ApiError {
  constructor() {
    super('El paciente no tiene un contacto al que enviar el mensaje de bienvenida', 409)
  }
}
