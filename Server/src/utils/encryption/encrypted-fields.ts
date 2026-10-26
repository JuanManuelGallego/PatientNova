/**
 * Registry of model fields that must be encrypted at rest.
 * Only String fields — Prisma enums cannot be encrypted at the application layer.
 */
import { contactHash, emailHash, nameTokens, phoneHash } from "./blind-index.js";

export const ENCRYPTED_FIELDS: Record<string, Set<string>> = {
  User: new Set([ "accountNumber", "nationalId", "bankingKey", "bankName" ]),
  MedicalRecord: new Set([
    "name",
    "nationalId",
    "birthPlace",
    "consultationReason",
    "earlyDevelopment",
    "schoolAndWork",
    "lifestyleHabits",
    "traumaticEvents",
    "emotionalConsiderations",
    "physicalConsiderations",
    "mentalHistory",
    "objective",
    "familyObservations",
    "familyType",
    "lifecycle",
    "genogram",
    "resources",
    "difficulties",
    "communication",
    "rule",
    "limits",
    "familyContext",
    "expectations",
    "flexibility",
  ]),
  FamilyMember: new Set([ "name", "relation" ]),
  EvolutionNote: new Set([ "text" ]),
  Patient: new Set([ "name", "lastName", "email", "whatsappNumber", "smsNumber", "notes" ]),
  Appointment: new Set([ "notes" ]),
  Reminder: new Set([ "to", "subject", "body" ]),
  AuditLog: new Set([ "actorDisplayName", "description", "ipAddress", "fieldsBefore", "fieldsAfter" ]),
  GoogleConnection: new Set([ "refreshToken" ]),
};

/**
 * Fields that contain Json (non-string) values and need JSON.stringify/parse
 * around the encrypt/decrypt calls.
 */
export const ENCRYPTED_JSON_FIELDS: Record<string, Set<string>> = {
  AuditLog: new Set([ "fieldsBefore", "fieldsAfter" ]),
};

export const BLIND_INDEXES: Record<string, Record<string, { column: string; derive: (value: string | null) => string | string[] | null }>> = {
  Patient: {
    name: { column: "nameTokens", derive: nameTokens },
    lastName: { column: "lastNameTokens", derive: nameTokens },
    email: { column: "emailHash", derive: emailHash },
    whatsappNumber: { column: "whatsappHash", derive: phoneHash },
    smsNumber: { column: "smsHash", derive: phoneHash },
  },
  Reminder: {
    to: { column: "toHash", derive: contactHash },
  },
  MedicalRecord: {
    name: { column: "nameTokens", derive: nameTokens },
  },
};

export const PII_VERSIONED_MODELS = new Set([ "Patient", "Reminder", "MedicalRecord" ]);
