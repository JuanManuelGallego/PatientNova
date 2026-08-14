import { test as base } from '@playwright/test';
import { ApiClient, createApiClient } from './utils/api';

type TestFixtures = {
  api: ApiClient;
  trackedAppointments: { track: (id: string) => void }
  trackedPatients: { track: (id: string) => void }
  trackedReminders: { track: (id: string) => void }
  trackedMedicalRecords: { track: (id: string) => void }
  trackedLocations: { track: (id: string) => void }
  trackedAppointmentTypes: { track: (id: string) => void }
  trackedBlockedTime: { track: (id: string) => void }
};

export const test = base.extend<TestFixtures>({
  api: async ({ page }, use) => {
    const api = createApiClient(page);
    await use(api);
  },
  trackedAppointments: async ({ api }, use) => {
    const ids: string[] = [];
    await use({ track: (id) => ids.push(id) });
    await Promise.allSettled(ids.map(id => api.deleteAppointment(id)));
  },
  trackedPatients: async ({ api }, use) => {
    const ids: string[] = [];
    await use({ track: (id) => ids.push(id) });
    await Promise.allSettled(ids.map(id => api.deletePatient(id)));
  },
  trackedReminders: async ({ api }, use) => {
    const ids: string[] = [];
    await use({ track: (id) => ids.push(id) });
    await Promise.allSettled(ids.map(id => api.deleteReminder(id)));
  },
  trackedMedicalRecords: async ({ api }, use) => {
    const ids: string[] = [];
    await use({ track: (id) => ids.push(id) });
    await Promise.allSettled(ids.map(id => api.deleteMedicalRecord(id)));
  },
  trackedLocations: async ({ api }, use) => {
    const ids: string[] = [];
    await use({ track: (id) => ids.push(id) });
    await Promise.allSettled(ids.map(id => api.deleteLocation(id)));
  },
  trackedAppointmentTypes: async ({ api }, use) => {
    const ids: string[] = [];
    await use({ track: (id) => ids.push(id) });
    await Promise.allSettled(ids.map(id => api.deleteAppointmentType(id)));
  },
  trackedBlockedTime: async ({ api }, use) => {
    const ids: string[] = [];
    await use({ track: (id) => ids.push(id) });
    await Promise.allSettled(ids.map(id => api.deleteBlockedTime(id)));
  },
});

export { expect } from '@playwright/test';
