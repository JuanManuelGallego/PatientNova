import { FetchAppointmentsFilters } from "../types/Appointment";
import { PatientStatus, FetchPatientsFilters } from "../types/Patient";
import { FetchRemindersFilters } from "../types/Reminder";

export const DEFAULT_STATUS = [ PatientStatus.ACTIVE, PatientStatus.INACTIVE ];

export const buildPatientQueryString = (filters?: FetchPatientsFilters): string => {
    const params = new URLSearchParams();

    const statusList =
        filters?.status
            ? Array.isArray(filters.status)
                ? filters.status
                : [ filters.status ]
            : DEFAULT_STATUS;

    statusList.forEach(s => params.append("status", s));

    if (filters?.search?.trim()) {
        params.set("search", filters.search.trim());
    }

    if (filters?.page && filters.page > 0) {
        params.set("page", String(filters.page));
    }

    if (filters?.pageSize && filters.pageSize > 0) {
        params.set("pageSize", String(filters.pageSize));
    }

    if (filters?.orderBy) {
        params.set("orderBy", filters.orderBy);
    }

    if (filters?.order) {
        params.set("order", filters.order);
    }

    if (filters?.from) {
        params.set("from", filters.from);
    }

    if (filters?.to) {
        params.set("to", filters.to);
    }

    const qs = params.toString();
    return qs ? `?${qs}` : "";
};

export const buildAppointmentQueryString = (filters?: FetchAppointmentsFilters): string => {
    const params = new URLSearchParams();

    if (filters?.patientId) {
        params.set("patientId", filters.patientId);
    }

    if (filters?.status) {
        params.set("status", filters.status);
    }

    if (filters?.startAt) {
        params.set("startAt", filters.startAt);
    }

    if (filters?.dateFrom) {
        params.set("dateFrom", filters.dateFrom);
    }

    if (filters?.dateTo) {
        params.set("dateTo", filters.dateTo);
    }

    if (filters?.search?.trim()) {
        params.set("search", filters.search.trim());
    }

    if (filters?.paid !== undefined) {
        params.set("paid", String(filters.paid));
    }

    if (filters?.page && filters.page > 0) {
        params.set("page", String(filters.page));
    }

    if (filters?.pageSize && filters.pageSize > 0) {
        params.set("pageSize", String(filters.pageSize));
    }

    if (filters?.orderBy) {
        params.set("orderBy", filters.orderBy);
    }

    if (filters?.order) {
        params.set("order", filters.order);
    }

    const qs = params.toString();
    return qs ? `?${qs}` : "";
};

export const buildReminderQueryString = (filters?: FetchRemindersFilters): string => {
    const params = new URLSearchParams();

    if (filters?.status) {
        const statusList = Array.isArray(filters.status) ? filters.status : [filters.status];
        statusList.forEach(s => params.append("status", s));
    }

    if (filters?.search?.trim()) {
        params.set("search", filters.search.trim());
    }

    if (filters?.patientId) {
        params.set("patientId", filters.patientId);
    }

    if (filters?.dateFrom) {
        params.set("dateFrom", filters.dateFrom);
    }

    if (filters?.dateTo) {
        params.set("dateTo", filters.dateTo);
    }

    if (filters?.page && filters.page > 0) {
        params.set("page", String(filters.page));
    }

    if (filters?.pageSize && filters.pageSize > 0) {
        params.set("pageSize", String(filters.pageSize));
    }

    if (filters?.orderBy) {
        params.set("orderBy", filters.orderBy);
    }

    if (filters?.order) {
        params.set("order", filters.order);
    }

    const qs = params.toString();
    return qs ? `?${qs}` : "";
};
