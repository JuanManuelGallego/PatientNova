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

export class PatientNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Patient with id "${id}" not found`, 404)
  }
}

export class LocationNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Appointment location with id "${id}" not found`, 404)
  }
}

export class UserNotFoundError extends ApiError {
  constructor(id: string) {
    super(`User with id "${id}" not found`, 404)
  }
}

export class ReminderNotCancellableError extends ApiError {
  constructor(status: string) {
    super(`Cannot cancel a reminder with status "${status}"`, 409)
  }
}
