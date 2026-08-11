import { Channel, ReminderMode } from '@/src/types/Reminder';
import { ApiClient, ApiResponse } from './api';
import { EntityTypes } from './const';
import { uniqueName, uniqueEmail, uniquePhoneNumber, futureDateTime, randomNumber } from './test-data';
import { Env } from './env';

export interface TestPatient {
  id: string;
  name: string;
}

export async function createTestPatient(
  api: ApiClient,
  overrides: Record<string, unknown> = {}
): Promise<TestPatient> {
  const name = uniqueName(EntityTypes.PATIENT);
  const defaults = { name, lastName: name, email: uniqueEmail() };
  const res = await api.createPatient({ ...defaults, ...overrides });
  return { id: res.data.id, name };
}

export async function createTestAppointment(
  api: ApiClient,
  patientId: string,
  overrides: Record<string, unknown> = {}
): Promise<ApiResponse> {
  const offset = randomNumber();
  const defaults = {
    patientId,
    locationId: Env.locationId,
    typeId: Env.apptTypeId,
    startAt: futureDateTime(offset),
    endAt: futureDateTime(offset + 1),
    sendMode: ReminderMode.SCHEDULED,
    paid: false,
    price: 100000,
  };
  return api.createAppointment({ ...defaults, ...overrides });
}

export async function createTestReminder(
  api: ApiClient,
  patientId: string,
  overrides: Record<string, unknown> = {}
): Promise<ApiResponse> {
  const defaults = {
    channel: Channel.WHATSAPP,
    to: uniquePhoneNumber(),
    sendMode: ReminderMode.SCHEDULED,
    sendAt: futureDateTime(48),
    patientId,
  };
  return api.createReminder({ ...defaults, ...overrides });
}

export async function createTestMedicalRecord(
  api: ApiClient,
  patientId: string,
  patientFullName: string,
  overrides: Record<string, unknown> = {}
): Promise<ApiResponse> {
  const defaults = {
    patientId,
    name: patientFullName,
    isFamily: false,
  };
  return api.createMedicalRecord({ ...defaults, ...overrides });
}

export async function createTestLocation(
  api: ApiClient,
  overrides: Record<string, unknown> = {}
): Promise<ApiResponse> {
  const defaults = { name: uniqueName('Loc'), address: '123 Test St', instructions: 'Test instructions' };
  return api.createLocation({ ...defaults, ...overrides });
}

export async function createTestAppointmentType(
  api: ApiClient,
  overrides: Record<string, unknown> = {}
): Promise<ApiResponse> {
  const defaults = { name: uniqueName('Type'), defaultDuration: 60, defaultPrice: 50000 };
  return api.createAppointmentType({ ...defaults, ...overrides });
}
