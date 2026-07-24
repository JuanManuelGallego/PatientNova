import { ApiError } from '../utils/errors/errors.js';

export class AppointmentTypeNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Appointment type with id "${id}" not found`, 404)
  }
}

export class AppointmentTypeNameConflictError extends ApiError {
  constructor(name: string) {
    super(`An appointment type named "${name}" already exists`, 409)
  }
}
