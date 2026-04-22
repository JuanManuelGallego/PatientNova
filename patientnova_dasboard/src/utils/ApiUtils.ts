import { FetchAppointmentsFilters } from "../types/Appointment";
import { PatientStatus, FetchPatientsFilters } from "../types/Patient";
import { FetchRemindersFilters } from "../types/Reminder";

export const DEFAULT_PATIENT_STATUS = [ PatientStatus.ACTIVE, PatientStatus.INACTIVE ];

/** Generic query string builder. Arrays become repeated params; empty/null/undefined values are skipped. */
export const buildQueryString = (params: Record<string, unknown>): string => {
    const searchParams = new URLSearchParams();
    for (const [ key, value ] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
            value.forEach(v => { if (v !== undefined && v !== null) searchParams.append(key, String(v)); });
        } else if (typeof value === "string") {
            if (value.trim()) searchParams.set(key, value.trim());
        } else {
            searchParams.set(key, String(value));
        }
    }
    const qs = searchParams.toString();
    return qs ? `?${qs}` : "";
};

export const buildPatientQueryString = (filters?: FetchPatientsFilters): string =>
    buildQueryString({
        status: filters?.status ?? DEFAULT_PATIENT_STATUS,
        search: filters?.search,
        page: (filters?.page ?? 0) > 0 ? filters?.page : undefined,
        pageSize: (filters?.pageSize ?? 0) > 0 ? filters?.pageSize : undefined,
        orderBy: filters?.orderBy,
        order: filters?.order,
        from: filters?.from,
        to: filters?.to,
    });

export const buildAppointmentQueryString = (filters?: FetchAppointmentsFilters): string =>
    buildQueryString({
        patientId: filters?.patientId,
        status: filters?.status,
        startAt: filters?.startAt,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
        search: filters?.search,
        paid: filters?.paid !== undefined ? filters.paid : undefined,
        page: (filters?.page ?? 0) > 0 ? filters?.page : undefined,
        pageSize: (filters?.pageSize ?? 0) > 0 ? filters?.pageSize : undefined,
        orderBy: filters?.orderBy,
        order: filters?.order,
    });

export const buildReminderQueryString = (filters?: FetchRemindersFilters): string =>
    buildQueryString({
        status: filters?.status,
        search: filters?.search,
        patientId: filters?.patientId,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
        page: (filters?.page ?? 0) > 0 ? filters?.page : undefined,
        pageSize: (filters?.pageSize ?? 0) > 0 ? filters?.pageSize : undefined,
        orderBy: filters?.orderBy,
        order: filters?.order,
    });
