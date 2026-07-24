import { ApiError } from '../utils/errors/errors.js';

export class MedicalRecordNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Medical record with id "${id}" not found`, 404)
  }
}

export class MedicalRecordAlreadyExistsError extends ApiError {
  constructor(patientId: string) {
    super(`A medical record for patient with id "${patientId}" already exists`, 409)
  }
}
