import { ApiError } from '../utils/errors/errors.js';

export class ProviderNotFoundError extends ApiError {
  constructor() {
    super('Provider not found', 404);
  }
}

export class PublicAppointmentTypeNotFoundError extends ApiError {
  constructor() {
    super('Appointment type not found', 404);
  }
}

export class ProviderImageNotFoundError extends ApiError {
  constructor() {
    super('Image not found', 404);
  }
}
