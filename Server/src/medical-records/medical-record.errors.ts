import { ApiError } from '../utils/errors/errors.js';

export class MedicalRecordNotFoundError extends ApiError {
  constructor(id: string) {
    super(`Medical record with id "${id}" not found`, 404)
  }
}

export class RecordDataInvalidError extends ApiError {
  constructor() {
    super('Los datos de la historia clínica no coinciden con la plantilla', 400)
  }
}

export class RecordDataCorruptError extends ApiError {
  constructor() {
    super('Stored medical record data is not a valid payload', 500)
  }
}

export class MedicalRecordAlreadyExistsError extends ApiError {
  constructor(patientId: string) {
    super(`A medical record for patient with id "${patientId}" already exists`, 409)
  }
}
