import { ApiError } from '../utils/errors/errors.js';

export class SlotUnavailableError extends ApiError {
  constructor() {
    super('Slot no longer available', 409);
  }
}

export class PortalBookingUnavailableError extends ApiError {
  constructor() {
    super('Online booking unavailable', 409);
  }
}

export class PortalBookingLimitError extends ApiError {
  constructor() {
    super('Booking limit reached', 409);
  }
}

/** One answer for every appointment the session may not act on: not theirs, unknown, past, inactive or deleted. */
export class PortalAppointmentNotFoundError extends ApiError {
  constructor() {
    super('Appointment not found', 404);
  }
}

/** The patient's appointment exists but can no longer be moved online (provider-created, or no longer bookable). */
export class PortalRescheduleUnavailableError extends ApiError {
  constructor() {
    super('Reschedule unavailable', 409);
  }
}

export class RescheduleSameTimeError extends ApiError {
  constructor() {
    super('New time must differ from the current one', 400);
  }
}
