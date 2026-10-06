import { Patient } from "./Patient";
import { Reminder, ReminderType } from "./Reminder";

export interface Appointment {
  id: string;

  createdAt: string;
  updatedAt: string;

  startAt: string;
  endAt: string;
  timezone: string;

  price: number;
  currency: string;
  paid: boolean;

  meetingUrl?: string | null;
  notes?: string | null;

  status: AppointmentStatus;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;

  patientId: string;
  reminderId?: string | null;
  locationId?: string | null;
  typeId?: string | null;

  patient: Patient;
  reminder?: Reminder | null;
  appointmentLocation: AppointmentLocation;
  appointmentType: AppointmentType;
}

export interface AppointmentForm {
  startAt: string;
  duration: string;
  price: number;
  paid: AppointmentPaidStatus;
  locationId: string;
  meetingUrl?: string;
  notes?: string;
  typeId: string;
  status: AppointmentStatus;
  patientId: string;
  reminderId?: string;
  reminderType: ReminderType;
  /** ISO send time; only used when reminderType is MANUAL. */
  reminderSendAt?: string;
}

export enum AppointmentDuration {
  MIN_45 = "45 min",
  MIN_50 = "50 min",
  MIN_60 = "1 h",
  MIN_90 = "90 min",
}

export enum AppointmentPaidStatus {
  PAID = "PAID",
  UNPAID = "UNPAID",
}

export const APPT_PAID_STATUS_CFG: Record<
  AppointmentPaidStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  [ AppointmentPaidStatus.PAID ]: {
    label: "Pagado",
    color: "#16A34A",
    bg: "#F0FDF4",
    icon: "",
  },
  [ AppointmentPaidStatus.UNPAID ]: {
    label: "Pendiente",
    color: "#DC2626",
    bg: "#FEF2F2",
    icon: "",
  },
};

export enum AppointmentStatus {
  SCHEDULED = "SCHEDULED",
  CONFIRMED = "CONFIRMED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

export const DEFAULT_APPT_STATUS = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
];

export const HISTORY_APPT_STATUS = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

export const APPT_STATUS_CFG: Record<
  AppointmentStatus,
  { label: string; color: string; bg: string; }
> = {
  [ AppointmentStatus.SCHEDULED ]: {
    label: "Programada",
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  [ AppointmentStatus.CONFIRMED ]: {
    label: "Confirmada",
    color: "#16A34A",
    bg: "#F0FDF4",
  },
  [ AppointmentStatus.COMPLETED ]: {
    label: "Completada",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  [ AppointmentStatus.CANCELLED ]: {
    label: "Cancelada",
    color: "#6B7280",
    bg: "#F3F4F6",
  },
  [ AppointmentStatus.NO_SHOW ]: {
    label: "No asistió",
    color: "#DC2626",
    bg: "#FEF2F2",
  },
};

export interface FetchAppointmentsFilters {
  patientId?: string;
  status?: AppointmentStatus[] | AppointmentStatus;
  startAt?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  paid?: boolean;
  typeId?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
  orderBy?:
    | "startAt"
    | "createdAt"
    | "status"
    | "price"
    | "location"
    | "type"
    | "patientName";
  order?: "asc" | "desc";
}

export interface AppointmentLocation {
  id: string;
  name: string;
  address?: string | null;
  color?: string | null;
  isVirtual: boolean;
  instructions?: string | null;
}

export type AppointmentLocationForm = {
  name: string;
  address: string;
  color: string;
  isVirtual: boolean;
  instructions: string;
};

export interface AppointmentType {
  id: string;
  name: string;
  description?: string | null;
  defaultDuration: number;
  defaultPrice?: number | null;
  color?: string | null;
}
