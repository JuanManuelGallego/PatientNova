/**
 * Centralized constants for list-page URL query state (filtering & sorting).
 *
 * Replaces the magic strings that were scattered across the patients,
 * appointments, reminders, audit-log and settings pages ("page", "tab",
 * "status", "asc"/"desc", the per-page `PAGE_SIZE = 10`, and the sort-field
 * tuples). Pages import from here so there is a single source of truth.
 */

/** Rows per page for every paginated list. */
export const PAGE_SIZE = 10;

/** Sort directions, used by the URL `order` param and the sort handler. */
export const SORT_DIRECTION = {
  asc: "asc",
  desc: "desc",
} as const;
export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

/**
 * Every URL query-state key used for filtering/sorting, grouped by resource so
 * each page reads `QUERY_PARAMS.<resource><Field>` instead of an inline string.
 * Different routes may share a key value (e.g. "tab") without collision.
 */
export const QUERY_PARAMS = {
  // shared by every list page
  page: "page",
  search: "search",
  orderBy: "orderBy",
  order: "order",

  // patients
  patientTab: "tab",

  // appointments
  apptTab: "tab",
  apptStatus: "status",
  apptPaid: "paid",
  apptTypeId: "typeId",
  apptLocationId: "locationId",
  apptDate: "dateFilter",

  // reminders
  reminderTab: "activeTab",
  reminderDate: "dateFilter",
  reminderStatus: "status",

  // audit logs
  auditEntityType: "entityType",
  auditActionType: "actionType",
  auditDate: "dateFilter",
  auditEntityId: "entityId",

  // settings
  settingsTab: "tab",

  // medical records
  recordPatientId: "patientId",
} as const;

// --- Sort-field configurations: the columns that can be ordered -----------

export const PATIENT_SORT = {
  orderBy: ["name", "email", "createdAt"] as const,
  sortable: ["name", "email", "createdAt"] as const,
} as const;
export type PatientOrderBy = (typeof PATIENT_SORT.orderBy)[number];

export const APPT_SORT = {
  orderBy: ["startAt", "status", "price", "createdAt"] as const,
  sortable: ["startAt", "status", "price"] as const,
} as const;
export type ApptOrderBy = (typeof APPT_SORT.orderBy)[number];

export const REMINDER_SORT = {
  orderBy: ["sendAt", "createdAt", "status", "updatedAt"] as const,
  sortable: ["sendAt", "status"] as const,
} as const;
export type ReminderOrderBy = (typeof REMINDER_SORT.orderBy)[number];

export const AUDIT_SORT = {
  orderBy: ["eventTimeUtc", "entityType", "actionType", "source", "actorId"] as const,
  sortable: ["eventTimeUtc", "entityType", "actionType"] as const,
} as const;
export type AuditOrderBy = (typeof AUDIT_SORT.orderBy)[number];
