import { AppointmentStatus } from "../../generated/prisma/client.ts";
import { prisma } from "../prisma/prismaClient.js";
import { logger } from "../utils/logger.ts";

export async function appointmentWorker(): Promise<void> {
  logger.info("Running appointment worker...");
  const now = new Date();

  const { count } = await prisma.appointment.updateMany({
    where: {
      status: { in: [ AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED ] },
      endAt: { lte: now },
    },
    data: { status: AppointmentStatus.COMPLETED, completedAt: now },
  });

  if (count === 0) {
    logger.info("No appointments to complete at this time");
  } else {
    logger.info({ count }, "Appointments marked as completed");
  }
}
