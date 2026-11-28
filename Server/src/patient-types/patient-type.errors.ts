import { ApiError } from '../utils/errors/errors.js';

export class PatientTypeNotFoundError extends ApiError {
  constructor() {
    super('Patient type not found', 404);
  }
}

export class PatientTypeNameConflictError extends ApiError {
  constructor() {
    super('Ya existe un tipo de paciente con ese nombre', 409);
  }
}

export class PatientTypeIsDefaultError extends ApiError {
  constructor() {
    super('No puedes eliminar el tipo de paciente predeterminado. Elige otro como predeterminado primero.', 409);
  }
}

export class PatientTypeInUseError extends ApiError {
  constructor(public readonly patientCount: number) {
    super(
      patientCount === 1
        ? 'Este tipo de paciente lo usa 1 paciente (incluidos los eliminados). Cámbialo de tipo antes de eliminarlo.'
        : `Este tipo de paciente lo usan ${patientCount} pacientes (incluidos los eliminados). Cámbialos de tipo antes de eliminarlo.`,
      409,
    );
  }
}

export class RecordTemplateInvalidError extends ApiError {
  constructor(reason: string) {
    super(`La plantilla no es válida: ${reason}`, 400);
  }
}

export class ConsentVersionNotFoundError extends ApiError {
  constructor() {
    super('Document not found', 404);
  }
}

export class ConsentVersionNotPdfError extends ApiError {
  constructor() {
    super('El formulario de consentimiento debe ser un archivo PDF', 400);
  }
}

export class ConsentVersionTooLargeError extends ApiError {
  constructor(maxMb: number) {
    super(`El formulario de consentimiento debe pesar menos de ${maxMb} MB`, 413);
  }
}
