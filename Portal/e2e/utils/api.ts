import { Page } from '@playwright/test';
import { Env } from './env';
export interface ApiResponse<T = { id: string }> {
    success: boolean;
    data: T;
    timestamp: string;
}

export interface ApiClient {
  createPatient(data: Record<string, unknown>): Promise<ApiResponse>;
  deletePatient(id: string): Promise<ApiResponse>;
  createLocation(data: Record<string, unknown>): Promise<ApiResponse>;
  deleteLocation(id: string): Promise<ApiResponse>;
  createAppointmentType(data: Record<string, unknown>): Promise<ApiResponse>;
  deleteAppointmentType(id: string): Promise<ApiResponse>;
  createAppointment(data: Record<string, unknown>): Promise<ApiResponse>;
  deleteAppointment(id: string): Promise<ApiResponse>;
  createReminder(data: Record<string, unknown>): Promise<ApiResponse>;
  cancelReminder(id: string): Promise<ApiResponse>;
  deleteReminder(id: string): Promise<ApiResponse>;
  createBlockedTime(data: Record<string, unknown>): Promise<ApiResponse>;
  deleteBlockedTime(id: string): Promise<ApiResponse>;
  createMedicalRecord(data: Record<string, unknown>): Promise<ApiResponse>;
  updateMedicalRecord(id: string, data: Record<string, unknown>): Promise<ApiResponse>;
  deleteMedicalRecord(id: string): Promise<ApiResponse>;
  updateProfile(data: Record<string, unknown>): Promise<ApiResponse>;
  deleteConsentDocument(): Promise<ApiResponse>;
  get(path: string): Promise<ApiResponse>;
  patch(path: string, data: Record<string, unknown>): Promise<ApiResponse>;
}

async function getAuthToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const tokenCookie = cookies.find(c => c.name === 'token');
  if (tokenCookie) return tokenCookie.value;

  try {
    return await page.evaluate(() => {
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
  } catch {
    return '';
  }
}

function apiBase(): string {
  return Env.apiBaseUrl;
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await getAuthToken(page);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers[ 'Authorization' ] = `Bearer ${token}`;
  return headers;
}

export function createApiClient(page: Page): ApiClient {
  const base = () => apiBase();

  async function request(method: string, path: string, body?: unknown): Promise<ApiResponse> {
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
    return resp.json() as Promise<ApiResponse>;
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
    updateMedicalRecord(id: string, data: Record<string, unknown>) {
      return request('PATCH', `/medical-records/${id}`, data);
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
