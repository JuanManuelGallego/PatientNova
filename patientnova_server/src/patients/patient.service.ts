import { prisma } from '../prisma/prismaClient.js';
import { PatientNotFoundError } from '../utils/errors.js';

/**
 * Business-logic layer for patient operations.
 * Orchestrates patient-related rules on top of the data layer.
 */
export const patientService = {
  /**
   * Asserts that a patient exists and belongs to the given user.
   * Throws {@link PatientNotFoundError} if not found or not owned by the user.
   */
  async verifyOwnership(patientId: string, userId: string): Promise<void> {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, userId },
      select: { id: true },
    });
    if (!patient) throw new PatientNotFoundError(patientId);
  },
};
