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
