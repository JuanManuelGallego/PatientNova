import type { Appointment } from '../../generated/prisma/client.ts';
import type { Prisma } from '../../generated/prisma/client.ts';

export const appointmentInclude = {
  patient: { select: { id: true, name: true, lastName: true, email: true } },
  reminder: { select: { id: true, channel: true, status: true, sendAt: true, contentVariables: true } },
  appointmentLocation: { select: { id: true, name: true, address: true, instructions: true, color: true, defaultPrice: true, isVirtual: true, isActive: true } },
  appointmentType: { select: { id: true, name: true, description: true, defaultDuration: true, defaultPrice: true, color: true, isActive: true } },
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

export interface AppointmentStats {
  total: number;
  todayCount: number;
  byStatus: Record<string, number>;
  totalRevenue: number;
  paidRevenue: number;
  unpaidRevenue: number;
  unpaidCount: number;
  paidRevenueThisMonth: number;
}

export type AppointmentWithDetails = Appointment & {
  patient: { name: string; lastName: string };
  appointmentLocation: { name: string } | null;
};
