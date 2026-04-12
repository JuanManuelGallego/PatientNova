import type { Patient, Prisma, Reminder } from "@prisma/client";

export enum Channel {
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
}

export interface SendWhatsAppRequest {
  to: string;
  contentSid: string;
  contentVariables?: Record<string, string>;
}

export interface SendSmsRequest {
  to: string;
  body: string;
}

export interface ScheduleRequest {
  channel: Channel;
  payload: SendWhatsAppRequest /*| SendSmsRequest*/;
  sendAt: string;
}

export interface NotificationResult {
  success: boolean;
  messageSid?: string;
  channel: Channel;
  to: string;
  sentAt: string;
  error?: string;
}

export interface ScheduleResult {
  jobId: string;
  channel: Channel;
  to: string;
  sentAt: string;
  sendAt: string;
}

export const appointmentInclude = {
  patient: { select: { id: true, name: true, lastName: true, email: true } },
  reminder: { select: { id: true, channel: true, status: true, sendAt: true } },
  appointmentLocation: { select: { id: true, name: true, address: true, meetingUrl: true, color: true, bg: true, dot: true, icon: true, defaultPrice: true, isVirtual: true, isActive: true } },
  appointmentType: { select: { id: true, name: true, description: true, defaultDuration: true, defaultPrice: true, color: true, icon: true, isActive: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

export const reminderInclude = {
  appointment: { select: { id: true, startAt: true, appointmentType: true, appointmentLocation: true, status: true } },
  patient: { select: { id: true, name: true, lastName: true, email: true } },
} satisfies Prisma.ReminderInclude;

export type ReminderWithRelations = Prisma.ReminderGetPayload<{
  include: typeof reminderInclude;
}>;

export interface PaginatedAppointments {
  data: AppointmentWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AppointmentStats {
  total: number;
  todayCount: number;
  byStatus: Record<string, number>;
  totalRevenue: number;
  paidRevenue: number;
  unpaidRevenue: number;
  unpaidCount: number;
}

export interface PaginatedPatients {
  data: Patient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


export interface PaginatedReminders {
  data: ReminderWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReminderStats {
  total: number;
  todayCount: number;
  byStatus: Record<string, number>;
  byChannel: Record<string, number>;
}
