import { Prisma } from "../../../generated/prisma/client.ts";
import {
  encrypt,
  decrypt,
  isEncrypted,
  EncryptionError,
} from "../encryption/field-encryption.js";
import { ENCRYPTED_FIELDS } from "../encryption/encrypted-fields.js";
import { config } from "../config/config.js";
import { logger } from "../api/logger.js";

const WRITE_OPERATIONS = new Set([
  "create",
  "update",
  "upsert",
  "createMany",
  "createManyAndReturn",
  "updateMany",
  "updateManyAndReturn",
]);

const READ_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "create",
  "update",
  "upsert",
  "createManyAndReturn",
  "updateManyAndReturn",
]);

function getKey(): string {
  const key = config.encryption.key;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new EncryptionError("ENCRYPTION_KEY is required in production");
    }
    return "";
  }
  return key;
}

function encryptField(value: unknown, model: string, field: string): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;

  const key = getKey();
  if (!key) {
    logger.error({ model, field }, "Encryption key not set — storing plaintext");
    return value;
  }

  if (isEncrypted(value)) return value; // idempotent
  return encrypt(value, key);
}

function decryptField(
  value: unknown,
  model: string,
  field: string,
  recordId?: string,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  if (!isEncrypted(value)) return value; // plaintext passthrough (pre-migration data)

  const key = getKey();
  if (!key) {
    logger.error(
      { model, field },
      "Encryption key not set — returning raw ciphertext",
    );
    return value;
  }

  try {
    return decrypt(value, key);
  } catch (err) {
    throw new EncryptionError(`Failed to decrypt ${model}.${field}`, {
      model,
      field,
      recordId,
    });
  }
}

/** Recursively encrypt fields in a data object for a given model. */
function encryptData(
  data: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields) return data;

  const result = { ...data };
  for (const field of fields) {
    if (field in result) {
      result[field] = encryptField(result[field], model, field);
    }
  }
  return result;
}

/** Walk nested write args (create, createMany, update, upsert) and encrypt related model fields. */
function encryptNestedWrites(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...data };

  for (const [key, value] of Object.entries(result)) {
    if (!value || typeof value !== "object") continue;

    // Check if this key corresponds to a model in the registry
    const modelName = toModelName(key);
    if (!modelName) continue;

    const nested = value as Record<string, unknown>;

    // Handle nested create
    if ("create" in nested) {
      const create = nested.create;
      if (Array.isArray(create)) {
        nested.create = create.map((item) =>
          encryptData(item as Record<string, unknown>, modelName),
        );
      } else if (create && typeof create === "object") {
        nested.create = encryptData(
          create as Record<string, unknown>,
          modelName,
        );
      }
    }

    // Handle nested createMany
    if (
      "createMany" in nested &&
      nested.createMany &&
      typeof nested.createMany === "object"
    ) {
      const cm = nested.createMany as Record<string, unknown>;
      if (Array.isArray(cm.data)) {
        cm.data = cm.data.map((item) =>
          encryptData(item as Record<string, unknown>, modelName),
        );
      }
    }

    // Handle nested update
    if ("update" in nested) {
      const update = nested.update;
      if (Array.isArray(update)) {
        nested.update = update.map((item) => {
          const i = item as Record<string, unknown>;
          if ("data" in i && i.data && typeof i.data === "object") {
            i.data = encryptData(i.data as Record<string, unknown>, modelName);
          }
          return i;
        });
      } else if (update && typeof update === "object") {
        const u = update as Record<string, unknown>;
        if ("data" in u && u.data && typeof u.data === "object") {
          u.data = encryptData(u.data as Record<string, unknown>, modelName);
        }
      }
    }

    // Handle nested upsert
    if ("upsert" in nested) {
      const upsert = nested.upsert;
      if (Array.isArray(upsert)) {
        nested.upsert = upsert.map((item) => {
          const i = item as Record<string, unknown>;
          if ("create" in i && i.create && typeof i.create === "object") {
            i.create = encryptData(
              i.create as Record<string, unknown>,
              modelName,
            );
          }
          if ("update" in i && i.update && typeof i.update === "object") {
            i.update = encryptData(
              i.update as Record<string, unknown>,
              modelName,
            );
          }
          return i;
        });
      } else if (upsert && typeof upsert === "object") {
        const u = upsert as Record<string, unknown>;
        if ("create" in u && u.create && typeof u.create === "object") {
          u.create = encryptData(
            u.create as Record<string, unknown>,
            modelName,
          );
        }
        if ("update" in u && u.update && typeof u.update === "object") {
          u.update = encryptData(
            u.update as Record<string, unknown>,
            modelName,
          );
        }
      }
    }

    result[key] = nested;
  }

  return result;
}

/** Decrypt fields in a result object (single record). */
function decryptRecord(
  record: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const fields = ENCRYPTED_FIELDS[model];
  const id = (record.id as string) ?? undefined;

  if (fields) {
    for (const field of fields) {
      if (field in record) {
        record[field] = decryptField(record[field], model, field, id);
      }
    }
  }

  // Decrypt nested relations
  for (const [key, value] of Object.entries(record)) {
    const modelName = toModelName(key);
    if (!modelName || !ENCRYPTED_FIELDS[modelName]) continue;

    if (Array.isArray(value)) {
      record[key] = value.map((item) =>
        item && typeof item === "object"
          ? decryptRecord(item as Record<string, unknown>, modelName)
          : item,
      );
    } else if (value && typeof value === "object" && !(value instanceof Date)) {
      record[key] = decryptRecord(value as Record<string, unknown>, modelName);
    }
  }

  return record;
}

/** Decrypt a result which may be a single record, an array, or a count. */
function decryptResult(result: unknown, model: string): unknown {
  if (result === null || result === undefined) return result;

  if (Array.isArray(result)) {
    return result.map((item) =>
      item && typeof item === "object"
        ? decryptRecord(item as Record<string, unknown>, model)
        : item,
    );
  }

  if (typeof result === "object") {
    return decryptRecord(result as Record<string, unknown>, model);
  }

  return result;
}

/**
 * Map relation field names to their model names.
 * Prisma uses camelCase plural/singular for relation fields.
 */
const RELATION_TO_MODEL: Record<string, string> = {
  familyMembers: "FamilyMember",
  evolutionNotes: "EvolutionNote",
  medicalRecord: "MedicalRecord",
  patient: "Patient",
  patients: "Patient",
  appointments: "Appointment",
  appointment: "Appointment",
  reminders: "Reminder",
  reminder: "Reminder",
  user: "User",
  users: "User",
};

function toModelName(relationField: string): string | undefined {
  return RELATION_TO_MODEL[relationField];
}

export const encryptionExtension = Prisma.defineExtension({
  name: "column-encryption",
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
      if (!model) return query(args);

      const fields = ENCRYPTED_FIELDS[model];

      // Encrypt on write
      if (WRITE_OPERATIONS.has(operation) && fields && args) {
        const a = args as Record<string, unknown>;

        if ("data" in a && a.data && typeof a.data === "object") {
          if (Array.isArray(a.data)) {
            // createMany data array
            a.data = a.data.map((item) => {
              let encrypted = encryptData(
                item as Record<string, unknown>,
                model,
              );
              encrypted = encryptNestedWrites(encrypted);
              return encrypted;
            });
          } else {
            a.data = encryptData(a.data as Record<string, unknown>, model);
            a.data = encryptNestedWrites(a.data as Record<string, unknown>);
          }
        }

        // upsert has create/update at top level
        if (operation === "upsert") {
          if ("create" in a && a.create && typeof a.create === "object") {
            a.create = encryptData(a.create as Record<string, unknown>, model);
            a.create = encryptNestedWrites(a.create as Record<string, unknown>);
          }
          if ("update" in a && a.update && typeof a.update === "object") {
            a.update = encryptData(a.update as Record<string, unknown>, model);
            a.update = encryptNestedWrites(a.update as Record<string, unknown>);
          }
        }
      }

      // Decrypt on read
      if (READ_OPERATIONS.has(operation)) {
        return query(args).then((result: unknown) =>
          decryptResult(result, model),
        );
      }

      return query(args);
    },
  },
});
