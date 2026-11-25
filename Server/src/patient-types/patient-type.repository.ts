import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';

/** Name of the type every new account starts with (#116: an empty template, the provider adds fields). */
export const DEFAULT_PATIENT_TYPE_NAME = 'General';

/** Version metadata: never the PDF bytes. */
export const consentVersionMetaSelect = {
  id: true,
  version: true,
  name: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

export const patientTypeRepository = {
  async listWithMeta(userId: string, tx: TransactionClient = prisma) {
    return tx.patientType.findMany({
      where: { userId },
      orderBy: [ { createdAt: 'asc' }, { name: 'asc' } ],
      include: {
        _count: { select: { patients: true } },
        consentVersions: { orderBy: { version: 'desc' }, take: 1, select: consentVersionMetaSelect },
      },
    });
  },

  async findOwned(userId: string, id: string, tx: TransactionClient = prisma) {
    return tx.patientType.findFirst({ where: { id, userId } });
  },

  async defaultIdOf(userId: string, tx: TransactionClient = prisma): Promise<string | null> {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { defaultPatientTypeId: true } });
    return user?.defaultPatientTypeId ?? null;
  },

  async countPatients(patientTypeId: string, tx: TransactionClient = prisma): Promise<number> {
    // Soft-deleted patients count: a restore needs their type.
    return tx.patient.count({ where: { patientTypeId } });
  },

  async listVersions(patientTypeId: string, tx: TransactionClient = prisma) {
    return tx.consentDocumentVersion.findMany({
      where: { patientTypeId },
      orderBy: { version: 'desc' },
      select: consentVersionMetaSelect,
    });
  },

  async currentVersion(patientTypeId: string, tx: TransactionClient = prisma) {
    return tx.consentDocumentVersion.findFirst({
      where: { patientTypeId },
      orderBy: { version: 'desc' },
      select: consentVersionMetaSelect,
    });
  },

  async lastVersionNumber(patientTypeId: string, tx: TransactionClient): Promise<number> {
    const last = await tx.consentDocumentVersion.findFirst({
      where: { patientTypeId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return last?.version ?? 0;
  },

  async findVersionContent(patientTypeId: string, versionId: string) {
    return prisma.consentDocumentVersion.findFirst({ where: { id: versionId, patientTypeId } });
  },
};
