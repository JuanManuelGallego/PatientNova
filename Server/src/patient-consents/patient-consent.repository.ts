import { ConsentKind } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';

export const patientConsentRepository = {
  async insertIfAbsent(tx: TransactionClient, data: {
    patientId: string;
    userId: string;
    kind: ConsentKind;
    policyVersion: string;
    acceptedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<boolean> {
    const { count } = await tx.patientConsent.createMany({ data: [ data ], skipDuplicates: true });
    return count > 0;
  },

  async findActive(patientId: string, kind: ConsentKind, policyVersion: string, tx?: TransactionClient) {
    return (tx ?? prisma).patientConsent.findFirst({
      where: { patientId, kind, policyVersion, revokedAt: null },
    });
  },

  /** A revocation made after `since`: a consent given before it must not come back. */
  async findRevokedSince(patientId: string, since: Date, tx: TransactionClient) {
    return tx.patientConsent.findFirst({ where: { patientId, revokedAt: { gte: since } }, select: { id: true } });
  },

  async findAllActive(patientId: string, tx: TransactionClient) {
    return tx.patientConsent.findMany({ where: { patientId, revokedAt: null } });
  },

  async markRevoked(id: string, revokedAt: Date, tx: TransactionClient) {
    return tx.patientConsent.update({ where: { id }, data: { revokedAt } });
  },
};
