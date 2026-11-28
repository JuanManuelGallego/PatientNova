import { prisma } from '../utils/prisma/prisma-client.js';
import { parseRecordData } from '../medical-records/record-data.js';

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
      patientType: { select: { id: true, name: true, template: true, familyMembersEnabled: true, subsystemRelationsEnabled: true } },
      medicalRecord: {
        omit: { nameTokens: true },
        include: { familyMembers: true, evolutionNotes: true, documents: true, subsystemRelations: true, snapshots: true },
      },
    },
    omit: { emailHash: true, whatsappHash: true, smsHash: true, nameTokens: true, lastNameTokens: true, piiVersion: true },
  });
  const patients = rows.map((p) => ({
    ...p,
    medicalRecord: p.medicalRecord && {
      ...p.medicalRecord,
      data: parseRecordData(p.medicalRecord.data),
      snapshots: p.medicalRecord.snapshots.map((s) => ({ ...s, data: parseRecordData(s.data) })),
    },
  }));
  return { exportedAt: new Date().toISOString(), clinicId: userId, patients };
}
