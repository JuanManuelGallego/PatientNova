import { ApiError } from '../utils/errors/errors.js';

/** The slot is taken, off-grid or outside the bookable window. Never echoes another appointment's times. */
export class SlotUnavailableError extends ApiError {
  constructor() {
    super('Slot no longer available', 409);
  }
}

/** One answer for revoked, inactive and deleted-only matches and the provider's patient cap. */
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
