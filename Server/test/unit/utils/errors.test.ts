import { describe, it, expect } from 'vitest';
import { ApiError, PatientNotFoundError, ReminderNotCancellableError } from '../../../src/utils/errors/errors.js';
import { AppointmentNotFoundError } from '../../../src/appointments/appointment.errors.js';
import { MedicalRecordAlreadyExistsError } from '../../../src/medical-records/medical-record.errors.js';
import { LocationNameConflictError } from '../../../src/locations/location.errors.js';
import { UserInvalidCredentialsError } from '../../../src/auth/auth.errors.js';

describe('ApiError', () => {
  it('sets message, status code, and class name', () => {
    const err = new ApiError('Bad input', 422);
    expect(err.message).toBe('Bad input');
    expect(err.errorCode).toBe(422);
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('error subclasses set correct status codes and embed context', () => {
  it('PatientNotFoundError has 404 and includes id', () => {
    const err = new PatientNotFoundError('abc-123');
    expect(err.errorCode).toBe(404);
    expect(err.message).toContain('abc-123');
    expect(err).toBeInstanceOf(ApiError);
  });

  it('AppointmentNotFoundError has 404', () => {
    expect(new AppointmentNotFoundError('xyz').errorCode).toBe(404);
  });

  it('MedicalRecordAlreadyExistsError has 409 and includes patient id', () => {
    const err = new MedicalRecordAlreadyExistsError('pid-1');
    expect(err.errorCode).toBe(409);
    expect(err.message).toContain('pid-1');
  });

  it('LocationNameConflictError has 409 and includes the name', () => {
    const err = new LocationNameConflictError('Main Office');
    expect(err.errorCode).toBe(409);
    expect(err.message).toContain('Main Office');
  });

  it('UserInvalidCredentialsError has 401', () => {
    expect(new UserInvalidCredentialsError().errorCode).toBe(401);
  });

  it('ReminderNotCancellableError has 409 and includes the status', () => {
    const err = new ReminderNotCancellableError('SENT');
    expect(err.errorCode).toBe(409);
    expect(err.message).toContain('SENT');
  });
});
