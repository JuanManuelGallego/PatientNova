import { AppointmentStatus } from '../../generated/prisma/client.ts';

export const ACTIVE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
]);
