import { AppointmentStatus } from "../../generated/prisma/client.ts";
import { prisma } from "../prisma/prismaClient.js";
import { logger } from "../utils/logger.ts";

export async function appointmentWorker(): Promise<void> {
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

  logger.info({ count: pending.length, appointmentIds: pending.map(a => a.id) }, "Appointments marked as completed");
}
