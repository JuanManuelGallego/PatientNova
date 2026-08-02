import { ApiError } from '../utils/errors/errors.js';

export class AuditLogNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Audit log with id "${id}" not found`, 404);
  }
}
