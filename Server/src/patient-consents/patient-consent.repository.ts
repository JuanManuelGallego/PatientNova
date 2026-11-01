import { ConsentKind } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';

/** Consent rows are immutable: insert and select only (revocation arrives in 7.2). */
export const patientConsentRepository = {
  /** Inserts unless an active row exists (ON CONFLICT DO NOTHING on `patient_consents_active_key`). */
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
};
