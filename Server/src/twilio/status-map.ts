import { ReminderStatus } from '../../generated/prisma/client.ts';

export const TWILIO_TO_PRISMA_STATUS: Partial<Record<string, ReminderStatus>> = {
  queued: ReminderStatus.QUEUED,
  sent: ReminderStatus.SENT,
  delivered: ReminderStatus.SENT,
  failed: ReminderStatus.FAILED,
  undelivered: ReminderStatus.FAILED,
};

const STATUS_RANK: Record<ReminderStatus, number> = {
  [ReminderStatus.PENDING]: -1,
  [ReminderStatus.QUEUED]: 0,
  [ReminderStatus.SENT]: 1,
  [ReminderStatus.FAILED]: 2,
  [ReminderStatus.CANCELLED]: 3,
};

export function statusRank(status: ReminderStatus): number {
  return STATUS_RANK[status] ?? -1;
}
