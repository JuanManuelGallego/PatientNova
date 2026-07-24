import { prisma } from './prisma-client.js';

/**
 * Execute multiple Prisma operations in a single database transaction.
 *
 * @example
 * const [patient, appointment] = await transaction(async (tx) => {
 *   const p = await tx.patient.create({ data: { ... } });
 *   const a = await tx.appointment.create({ data: { patientId: p.id, ... } });
 *   return [p, a];
 * });
 */
export const transaction = prisma.$transaction.bind(prisma);
