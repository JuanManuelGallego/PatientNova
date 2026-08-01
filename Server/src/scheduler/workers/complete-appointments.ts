import { AppointmentStatus } from "../../../generated/prisma/client.ts";
import { prisma } from "../../utils/prisma/prisma-client.js";
import { logger } from "../../utils/api/logger.js";
import { logAudit } from "../../audit-log/audit-log.utils.js";
import { runInAuditContext } from "../../audit-log/audit-log-context.js";
import { EntityType, ActionType, ActionSource } from '../../../generated/prisma/enums.ts';

const JOB_CTX = { actorId: 'scheduler', actorDisplayName: 'Scheduler Worker' };

export async function completeAppointmentsWorker(): Promise<void> {
  logger.debug("Running appointment worker...");
  const now = new Date();

  const pending = await prisma.appointment.findMany({
    where: {
      status: { in: [ AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED ] },
      endAt: { lte: now },
    },
    select: { id: true, patientId: true, status: true },
  });

  if (pending.length === 0) {
    logger.debug("No appointments to complete at this time");
    return;
  }

  await prisma.appointment.updateMany({
    where: {
      status: { in: [ AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED ] },
      endAt: { lte: now },
    },
    data: { status: AppointmentStatus.COMPLETED, completedAt: now },
  });

  await runInAuditContext(JOB_CTX, () => Promise.all(
    pending.map(a => logAudit({
      entityType: EntityType.APPOINTMENT,
      entityId: a.id,
      actionType: ActionType.UPDATE,
      source: ActionSource.JOB,
      description: `Cita completada automáticamente`,
      affectedFields: ['status'],
      fieldsBefore: { status: a.status },
      fieldsAfter: { status: AppointmentStatus.COMPLETED },
    }))
  ));

  logger.info({ count: pending.length, appointmentIds: pending.map(a => a.id) }, "Appointments marked as completed");
}
