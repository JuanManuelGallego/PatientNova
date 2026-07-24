import { ApiError } from '../utils/errors/errors.js';

export class AppointmentNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Appointment with id "${id}" not found`, 404)
  }
}

export class AppointmentPatientNotFoundError extends ApiError {
  constructor(patientId: string) {
    super(`Patient with id "${patientId}" does not exist`, 422)
  }
}

export class AppointmentReminderNotFoundError extends ApiError {
  constructor(reminderId: string) {
    super(`Reminder with id "${reminderId}" does not exist`, 422)
  }
}

export class AppointmentStatusTransitionError extends ApiError {
  constructor(currentStatus: string, action: string) {
    super(`Cannot ${action} an appointment with status "${currentStatus}"`, 409)
  }
}

export class AppointmentConflictError extends ApiError {
  constructor(startAt: string, endAt: string) {
    super(`Appointment conflicts with an existing appointment between ${startAt} and ${endAt}`, 409)
  }
}
