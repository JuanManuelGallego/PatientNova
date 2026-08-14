import { Page } from '@playwright/test';
import { Env } from './env';
export interface ApiResponse<T = { id: string }> {
    success: boolean;
    data: T;
    timestamp: string;
}

export interface AppointmentData {
  id: string;
  patientId: string;
  typeId: string;
  locationId: string;
  price: number;
  status: string;
  paid: boolean;
  startAt?: string;
  endAt?: string;
}

export interface LocationData {
  id: string;
  name: string;
  address: string;
  instructions?: string;
  isVirtual?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
}

export interface AppointmentTypeData {
  id: string;
  name: string;
  defaultDuration: number;
  defaultPrice: number;
  description?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
}

export interface ReminderData {
  id: string;
  sendAt: string;
  status: string;
  patientId?: string;
  channel?: string;
}

export interface BlockedTimeData {
  id: string;
  description: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
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
  // ── Read helpers (post-action verification) ──────────────────────────────────
  getAppointment(id: string): Promise<ApiResponse<AppointmentData>>;
  getReminder(id: string): Promise<ApiResponse<ReminderData>>;
  getLocation(id: string): Promise<ApiResponse<LocationData>>;
  getAppointmentType(id: string): Promise<ApiResponse<AppointmentTypeData>>;
  getMedicalRecord(id: string): Promise<ApiResponse>;
  getBlockedTime(id: string): Promise<ApiResponse<BlockedTimeData>>;
  getAuditLogs(query?: Record<string, string>): Promise<ApiResponse>;
  // ── Non-throwing request for expected negative responses ──────────────────────
  requestRaw(method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }>;
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

  async function request<T = { id: string }>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
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
    return resp.json() as Promise<ApiResponse<T>>;
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

    // ── Read helpers ────────────────────────────────────────────────────────────
    getAppointment(id: string) {
      return request<AppointmentData>('GET', `/appointments/${id}`);
    },
    getReminder(id: string) {
      return request<ReminderData>('GET', `/reminders/${id}`);
    },
    getLocation(id: string) {
      return request<LocationData>('GET', `/locations/${id}`);
    },
    getAppointmentType(id: string) {
      return request<AppointmentTypeData>('GET', `/appointment-types/${id}`);
    },
    getMedicalRecord(id: string) {
      return request('GET', `/medical-records/${id}`);
    },
    getBlockedTime(id: string) {
      return request<BlockedTimeData>('GET', `/blocked-time/${id}`);
    },
    getAuditLogs(query?: Record<string, string>) {
      const qs = query
        ? '?' + new URLSearchParams(query).toString()
        : '';
      return request('GET', `/audit-logs${qs}`);
    },

    // ── Non-throwing request for expected negative responses ────────────────────
    async requestRaw(method: string, path: string, body?: unknown) {
      const headers = await authHeaders(page);
      const resp = await page.request.fetch(`${base()}${path}`, {
        method,
        headers,
        data: body,
      });
      let parsed: unknown = null;
      try {
        parsed = await resp.json();
      } catch {
        parsed = await resp.text();
      }
      return { status: resp.status(), body: parsed };
    },
  };
}
