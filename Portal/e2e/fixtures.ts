import { test as base } from '@playwright/test';
import { ApiClient, createApiClient } from './utils/api';

type TestFixtures = {
  api: ApiClient;
  trackedAppointments: { track: (id: string) => void }
  trackedPatients: { track: (id: string) => void }
  trackedReminders: { track: (id: string) => void }
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
});

export { expect } from '@playwright/test';
