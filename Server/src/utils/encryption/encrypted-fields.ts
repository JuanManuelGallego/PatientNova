/**
 * Registry of model fields that must be encrypted at rest.
 * Only String fields — Prisma enums cannot be encrypted at the application layer.
 */
export const ENCRYPTED_FIELDS: Record<string, Set<string>> = {
  User: new Set([ "accountNumber", "nationalId", "bankingKey", "bankName" ]),
  MedicalRecord: new Set([
    "nationalId",
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
  Patient: new Set([ "notes" ]),
  Appointment: new Set([ "notes" ]),
  Reminder: new Set([ "body" ]),
  AuditLog: new Set([ "actorDisplayName", "description", "ipAddress", "fieldsBefore", "fieldsAfter" ]),
};

/**
 * Fields that contain Json (non-string) values and need JSON.stringify/parse
 * around the encrypt/decrypt calls.
 */
export const ENCRYPTED_JSON_FIELDS: Record<string, Set<string>> = {
  AuditLog: new Set([ "fieldsBefore", "fieldsAfter" ]),
};
