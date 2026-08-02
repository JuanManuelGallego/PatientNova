import { Prisma } from "../../../generated/prisma/client.ts";

const IMMUTABLE_OPERATIONS = new Set([
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

export const auditLogGuardExtension = Prisma.defineExtension({
  name: 'audit-log-immutability',
  query: {
    $allOperations({
      model,
      operation,
      args,
      query,
    }: {
      model?: string;
      operation: string;
      args: unknown;
      query: (args: unknown) => Promise<unknown>;
    }) {
      if (model === 'AuditLog' && IMMUTABLE_OPERATIONS.has(operation)) {
        throw new Error(`AuditLog is immutable: ${operation} is not allowed`);
      }
      return query(args);
    },
  },
});
