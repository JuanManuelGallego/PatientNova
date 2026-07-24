import { ApiError } from '../utils/errors/errors.js';

export class ReminderNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Reminder with id "${id}" not found`, 404)
  }
}

export class ReminderSendAtInPastError extends ApiError {
  constructor() {
    super('Scheduled reminders must have a sendAt time in the future', 422)
  }
}
