import { Relationship, Sex } from '@prisma/client';
import { z } from 'zod';

const familyMemberSchema = z.object({
  name: z.string().optional(),
  sex: z.nativeEnum(Sex).optional().catch(() => undefined),
  age: z.string().optional(),
  relationship: z.nativeEnum(Relationship).optional(),
  relation: z.string().optional(),
});

const evolutionNoteSchema = z.object({
  date: z.string().datetime().catch(() => new Date().toISOString()).default(() => new Date().toISOString()),
  text: z.string().optional(),
});

const medicalRecordBaseSchema = z.object({
  // Personal data
  name: z.string().optional(),
  nationalId: z.string().optional(),
  sex: z.nativeEnum(Sex).optional().catch(() => undefined),
  age: z.string().optional(),
  birthDate: z.string().datetime().optional().catch(() => undefined),
  birthPlace: z.string().optional(),

  // Clinical history
  consultationReason: z.string().optional(),
  earlyDevelopment: z.string().optional(),
  schoolAndWork: z.string().optional(),
  lifestyleHabits: z.string().optional(),
  traumaticEvents: z.string().optional(),
  emotionalConsiderations: z.string().optional(),
  physicalConsiderations: z.string().optional(),
  mentalHistory: z.string().optional(),
  objective: z.string().optional(),

  // Relations
  familyMembers: z.array(familyMemberSchema).optional(),
  evolutionNotes: z.array(evolutionNoteSchema).optional(),
});

export const createMedicalRecordSchema = medicalRecordBaseSchema.extend({
  patientId: z.string().uuid('patientId must be a valid UUID'),
});

export const updateMedicalRecordSchema = medicalRecordBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const listMedicalRecordsSchema = z.object({
  patientId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional().transform((v) => v === '' ? undefined : v),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum([ 'createdAt', 'updatedAt' ]).default('createdAt'),
  order: z.enum([ 'asc', 'desc' ]).default('desc'),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type CreateMedicalRecordDto = z.infer<typeof createMedicalRecordSchema>;
export type UpdateMedicalRecordDto = z.infer<typeof updateMedicalRecordSchema>;
export type ListMedicalRecordsQuery = z.infer<typeof listMedicalRecordsSchema>;
export type FamilyMemberDto = z.infer<typeof familyMemberSchema>;
export type EvolutionNoteDto = z.infer<typeof evolutionNoteSchema>;