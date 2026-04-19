import { describe, it, expect } from 'vitest';
import {
  ApiError,
  PatientNotFoundError,
  AppointmentNotFoundError,
  MedicalRecordAlreadyExistsError,
  LocationNameConflictError,
  UserInvalidCredentialsError,
  ReminderNotCancellableError,
} from './errors.js';

describe('ApiError', () => {
  it('sets message and default status 400', () => {
    const err = new ApiError('Bad input');
    expect(err.message).toBe('Bad input');
    expect(err.errorCode).toBe(400);
    expect(err).toBeInstanceOf(Error);
  });

  it('accepts a custom status code', () => {
    const err = new ApiError('Not found', 404);
    expect(err.errorCode).toBe(404);
  });

  it('sets name to class name', () => {
    const err = new ApiError('oops');
    expect(err.name).toBe('ApiError');
  });
});

describe('PatientNotFoundError', () => {
  it('has 404 status and includes the id in the message', () => {
    const err = new PatientNotFoundError('abc-123');
    expect(err.errorCode).toBe(404);
    expect(err.message).toContain('abc-123');
    expect(err).toBeInstanceOf(ApiError);
  });
});

describe('AppointmentNotFoundError', () => {
  it('has 404 status', () => {
    const err = new AppointmentNotFoundError('xyz');
    expect(err.errorCode).toBe(404);
  });
});

describe('MedicalRecordAlreadyExistsError', () => {
  it('has 409 status and includes patient id', () => {
    const err = new MedicalRecordAlreadyExistsError('pid-1');
    expect(err.errorCode).toBe(409);
    expect(err.message).toContain('pid-1');
  });
});

describe('LocationNameConflictError', () => {
  it('has 409 status and includes the location name', () => {
    const err = new LocationNameConflictError('Main Office');
    expect(err.errorCode).toBe(409);
    expect(err.message).toContain('Main Office');
  });
});

describe('UserInvalidCredentialsError', () => {
  it('has 401 status', () => {
    const err = new UserInvalidCredentialsError();
    expect(err.errorCode).toBe(401);
  });
});

describe('ReminderNotCancellableError', () => {
  it('has 409 status and includes the status string', () => {
    const err = new ReminderNotCancellableError('SENT');
    expect(err.errorCode).toBe(409);
    expect(err.message).toContain('SENT');
  });
});
