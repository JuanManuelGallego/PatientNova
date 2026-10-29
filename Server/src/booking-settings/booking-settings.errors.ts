import { ApiError } from '../utils/errors/errors.js';

export type BookingReadinessKey = 'slug' | 'availability' | 'bookableType' | 'bookableLocation';

export class BookingSlugTakenError extends ApiError {
  constructor() {
    super('Booking link is not available', 409)
  }
}

export class BookingNotReadyError extends ApiError {
  constructor(public missing: BookingReadinessKey[]) {
    super(`Online booking cannot be enabled yet; missing: ${missing.join(', ')}`, 422)
  }
}

export class BookingAvailabilityRequiredError extends ApiError {
  constructor() {
    super('Availability cannot be empty while online booking is enabled', 422)
  }
}
