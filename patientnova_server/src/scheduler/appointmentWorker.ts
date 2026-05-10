import { AppointmentStatus } from "../../generated/prisma/client.ts";
import { prisma } from "../prisma/prismaClient.js";
import { ONE_HOUR_MS } from "../utils/constants.ts";
import { logger } from "../utils/logger.ts";

export async function appointmentWorker(): Promise<void> {
  logger.info("Running appointment worker...");
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - ONE_HOUR_MS);

  const toComplete = await prisma.appointment.findMany({
    where: {
      status: { in: [ AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED ] },
      startAt: { lte: oneHourAgo },
    },
  });

  if (toComplete.length === 0) {
    logger.info("No appointments to complete at this time");
    return;
  }

  for (const appointment of toComplete) {
    try {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.COMPLETED, completedAt: now },
      });
      logger.info({ appointmentId: appointment.id }, "Appointment marked completed");
    } catch (error) {
      logger.error({ appointmentId: appointment.id, error }, "Failed to complete appointment");
    }
  }
}
