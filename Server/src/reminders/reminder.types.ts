import type { Prisma } from '../../generated/prisma/client.ts';

export const reminderInclude = {
  appointment: { select: { id: true, startAt: true, appointmentType: true, appointmentLocation: true, status: true } },
  patient: { select: { id: true, name: true, lastName: true, email: true } },
} satisfies Prisma.ReminderInclude;

export type ReminderWithRelations = Prisma.ReminderGetPayload<{
  include: typeof reminderInclude;
}>;

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
