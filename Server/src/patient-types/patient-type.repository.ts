import { randomUUID } from 'node:crypto';
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

/** The highest version of a type: its current consent document. */
const latestVersion = { orderBy: { version: 'desc' }, take: 1 } as const;

/**
 * Writes a user together with its default patient type ("General"), on `tx`. `write` creates (or upserts) the user
 * with the given `defaultPatientTypeId`; the type is then created under that id. The two rows reference each other,
 * and the user's foreign key is checked at commit, so both writes must share one transaction. An upsert that found
 * an existing user keeps that user's default, and no type is created.
 */
export async function createUserWithDefaultType<T extends { id: string; defaultPatientTypeId: string }>(
  tx: TransactionClient,
  write: (defaultPatientTypeId: string) => Promise<T>,
): Promise<T> {
  const defaultPatientTypeId = randomUUID();
  const user = await write(defaultPatientTypeId);
  if (user.defaultPatientTypeId === defaultPatientTypeId) {
    await tx.patientType.create({ data: { id: defaultPatientTypeId, userId: user.id, name: DEFAULT_PATIENT_TYPE_NAME } });
  }
  return user;
}

export const patientTypeRepository = {
  async listWithMeta(userId: string, tx: TransactionClient = prisma) {
    return tx.patientType.findMany({
      where: { userId },
      orderBy: [ { createdAt: 'asc' }, { name: 'asc' } ],
      include: {
        _count: { select: { patients: true } },
        consentVersions: { ...latestVersion, select: consentVersionMetaSelect },
      },
    });
  },

  async findOwned(userId: string, id: string, tx: TransactionClient = prisma) {
    return tx.patientType.findFirst({ where: { id, userId } });
  },

  async defaultIdOf(userId: string, tx: TransactionClient = prisma): Promise<string> {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { defaultPatientTypeId: true } });
    return user.defaultPatientTypeId;
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
    return tx.consentDocumentVersion.findFirst({ where: { patientTypeId }, ...latestVersion, select: consentVersionMetaSelect });
  },

  async createVersion(
    data: { patientTypeId: string; version: number; name: string; content: Uint8Array<ArrayBuffer>; mimeType: string; sizeBytes: number },
    tx: TransactionClient,
  ) {
    return tx.consentDocumentVersion.create({ data, select: consentVersionMetaSelect });
  },

  async findVersionContent(patientTypeId: string, versionId: string) {
    return prisma.consentDocumentVersion.findFirst({ where: { id: versionId, patientTypeId } });
  },

  /** A version with its bytes, by id alone: only for the public link, whose id is the proof. */
  async findVersionWithContent(id: string) {
    return prisma.consentDocumentVersion.findUnique({ where: { id } });
  },

  /** The current version (with bytes) of a provider's default type, or null when `userId` is no user. */
  async findDefaultCurrentWithContent(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { defaultPatientTypeId: true } });
    if (!user) return null;
    return prisma.consentDocumentVersion.findFirst({ where: { patientTypeId: user.defaultPatientTypeId }, ...latestVersion });
  },
};
