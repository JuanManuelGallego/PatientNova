import type { Prisma } from '../../generated/prisma/client.ts';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';
import { lockRecord, parseRecordData } from './record-data.js';

export interface ArchivedType {
  id: string;
  name: string;
  template: unknown;
}

/**
 * Before a patient changes type: archives the record's payload with the template it was written against, then empties
 * the payload. Returns the snapshot id, or null when there is no record or nothing to archive. Locks the record row, so a
 * save waiting on it is checked against the new type's template once this transaction commits.
 */
export async function archiveRecordForTypeChange(tx: TransactionClient, patientId: string, oldType: ArchivedType): Promise<string | null> {
  const record = await tx.medicalRecord.findUnique({ where: { patientId }, select: { id: true } });
  if (!record) return null;
  await lockRecord(tx, record.id);
  const { data } = await tx.medicalRecord.findUniqueOrThrow({ where: { id: record.id }, select: { data: true } });
  const payload = parseRecordData(data);
  if (Object.keys(payload).length === 0) return null;

  const snapshot = await tx.medicalRecordSnapshot.create({
    data: {
      medicalRecordId: record.id,
      patientTypeId: oldType.id,
      patientTypeName: oldType.name,
      template: oldType.template as Prisma.InputJsonValue,
      data: JSON.stringify(payload),
    },
    select: { id: true },
  });
  await tx.medicalRecord.update({ where: { id: record.id }, data: { data: '{}' }, select: { id: true } });
  return snapshot.id;
}
