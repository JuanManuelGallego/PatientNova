/**
 * Registry of model fields that must be encrypted at rest.
 * Only String fields — Prisma enums cannot be encrypted at the application layer.
 */
export const ENCRYPTED_FIELDS: Record<string, Set<string>> = {
  User: new Set(["accountNumber", "nationalId", "bankingKey", "bankName"]),
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
  ]),
  FamilyMember: new Set(["name", "relation"]),
  EvolutionNote: new Set(["text"]),
  Patient: new Set(["notes"]),
  Appointment: new Set(["notes"]),
  Reminder: new Set(["body"]),
};
