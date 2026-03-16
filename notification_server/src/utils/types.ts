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
  sendAt: string;
  scheduledAt: string;
}

export const appointmentInclude = {
  patient: { select: { id: true, name: true, lastName: true, email: true } },
  reminder: { select: { id: true, channel: true, status: true, sendAt: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

export interface PaginatedAppointments {
  data: AppointmentWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedPatients {
  data: Patient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


export interface PaginatedReminders {
  data: Reminder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
