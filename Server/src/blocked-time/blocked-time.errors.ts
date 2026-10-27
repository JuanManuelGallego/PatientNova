import { ApiError } from '../utils/errors/errors.js';

export class BlockedTimeNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Blocked time with id "${id}" not found`, 404)
  }
}

export class BlockedTimeOverlapError extends ApiError {
  constructor(startAt: Date, endAt: Date) {
    super(`Blocked time overlaps with an existing blocked slot (${startAt.toISOString()} – ${endAt.toISOString()})`, 409)
  }
}

export class BlockedTimeInvalidRangeError extends ApiError {
  constructor() {
    super('endTimeUtc must be after startTimeUtc', 400)
  }
}
