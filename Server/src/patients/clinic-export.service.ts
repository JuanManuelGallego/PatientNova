import { prisma } from '../utils/prisma/prisma-client.js';

/** The clinic's patients in readable form, for leaving the service. Soft-deleted rows are included on purpose. */
export async function buildClinicExport(userId: string) {
  const clinic = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!clinic) throw new Error('Clinic not found');

  const rows = await prisma.patient.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      appointments: true,
      reminders: { omit: { toHash: true } },
      consents: true,
      medicalRecord: {
        omit: { nameTokens: true },
        include: { familyMembers: true, evolutionNotes: true, documents: true, subsystemRelations: true },
      },
    },
    omit: { emailHash: true, whatsappHash: true, smsHash: true, nameTokens: true, lastNameTokens: true, piiVersion: true },
  });
  return { exportedAt: new Date().toISOString(), clinicId: userId, patients: rows };
}
