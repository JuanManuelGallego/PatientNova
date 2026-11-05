import { ApiError } from '../utils/errors/errors.js';

export class BookingRequestNotFoundError extends ApiError {
  constructor() {
    super('Booking request not found', 404);
  }
}

/** Already approved, rejected, cancelled or expired (including a hold past its expiry the sweep has not flipped yet). */
export class BookingRequestNotPendingError extends ApiError {
  constructor() {
    super('Booking request is no longer pending', 409);
  }
}

export class BookingRequestCandidateError extends ApiError {
  constructor() {
    super('Patient not found for this request', 404);
  }
}

export class BookingRequestRestoreCandidateError extends ApiError {
  constructor() {
    super('Patient to restore not found for this request', 404);
  }
}
