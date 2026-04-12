export class ApiError extends Error {
  constructor(
    message: string,
    public errorCode: number = 400,
  ) {
    super(message)
    this.name = this.constructor.name
    this.errorCode = errorCode
  }
}

export class ReminderNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Reminder with id "${id}" not found`, 404)
  }
}

export class ReminderNotCancellableError extends ApiError {
  constructor(status: string) {
    super(`Cannot cancel a reminder with status "${status}"`, 409)
  }
}

export class PatientNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Patient with id "${id}" not found`, 404)
  }
}

export class PatientEmailConflictError extends ApiError {
  constructor(email: string) {
    super(`A patient with email "${email}" already exists`, 409)
  }
}

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

export class LocationNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Appointment location with id "${id}" not found`, 404)
  }
}

export class LocationNameConflictError extends ApiError {
  constructor(name: string) {
    super(`An appointment location named "${name}" already exists`, 409)
  }
}

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
