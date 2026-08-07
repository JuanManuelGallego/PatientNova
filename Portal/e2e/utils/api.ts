import { Page } from '@playwright/test';

interface ApiEntity {
  id: string;
  [key: string]: unknown;
}

async function getAuthToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const cookies = document.cookie.split(';').map(c => c.trim());
    const tokenCookie = cookies.find(c => c.startsWith('token='));
    if (tokenCookie) return tokenCookie.split('=').slice(1).join('=');

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('token') || key.includes('auth') || key.includes('jwt'))) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const parsed = JSON.parse(val);
            return parsed.accessToken || parsed.token || parsed.jwt || val;
          } catch {
            return val;
          }
        }
      }
    }
    return '';
  });
}

function apiBase(page: Page): string {
  const url = page.url();
  const origin = new URL(url).origin;
  return `${origin}/v1`;
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await getAuthToken(page);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function createApiClient(page: Page) {
  const base = () => apiBase(page);

  async function request(method: string, path: string, body?: unknown): Promise<ApiEntity> {
    const headers = await authHeaders(page);
    const resp = await page.request.fetch(`${base()}${path}`, {
      method,
      headers,
      data: body,
    });
    if (!resp.ok()) {
      const text = await resp.text();
      throw new Error(`API ${method} ${path} failed (${resp.status()}): ${text}`);
    }
    return resp.json() as Promise<ApiEntity>;
  }

  return {
    // Patients
    createPatient(data: Record<string, unknown>) {
      return request('POST', '/patients', data);
    },
    deletePatient(id: string) {
      return request('DELETE', `/patients/${id}`);
    },

    // Locations
    createLocation(data: Record<string, unknown>) {
      return request('POST', '/locations', data);
    },
    deleteLocation(id: string) {
      return request('DELETE', `/locations/${id}`);
    },

    // Appointment Types
    createAppointmentType(data: Record<string, unknown>) {
      return request('POST', '/appointment-types', data);
    },
    deleteAppointmentType(id: string) {
      return request('DELETE', `/appointment-types/${id}`);
    },

    // Appointments
    createAppointment(data: Record<string, unknown>) {
      return request('POST', '/appointments', data);
    },
    deleteAppointment(id: string) {
      return request('DELETE', `/appointments/${id}`);
    },

    // Reminders
    createReminder(data: Record<string, unknown>) {
      return request('POST', '/reminders', data);
    },
    cancelReminder(id: string) {
      return request('PATCH', `/reminders/${id}`, { status: 'CANCELLED' });
    },
    deleteReminder(id: string) {
      return request('DELETE', `/reminders/${id}`);
    },

    // Blocked Time
    createBlockedTime(data: Record<string, unknown>) {
      return request('POST', '/blocked-time', data);
    },
    deleteBlockedTime(id: string) {
      return request('DELETE', `/blocked-time/${id}`);
    },

    // Medical Records
    createMedicalRecord(data: Record<string, unknown>) {
      return request('POST', '/medical-records', data);
    },
    deleteMedicalRecord(id: string) {
      return request('DELETE', `/medical-records/${id}`);
    },

    // Users
    updateProfile(data: Record<string, unknown>) {
      return request('PATCH', '/users/me', data);
    },

    // Consent
    deleteConsentDocument() {
      return request('DELETE', '/consent-document');
    },

    // Generic
    get(path: string) {
      return request('GET', path);
    },
    patch(path: string, data: Record<string, unknown>) {
      return request('PATCH', path, data);
    },
  };
}
