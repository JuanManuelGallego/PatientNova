import type { Prisma } from '../../generated/prisma/client.ts';
import { parseStoredTemplate, type RecordTemplate } from '../patient-types/record-template.js';
import { parseRecordData, type RecordData } from './record-data.js';

export const recordTypeSelect = {
  id: true,
  name: true,
  template: true,
  familyMembersEnabled: true,
  subsystemRelationsEnabled: true,
} as const;

export const recordInclude = {
  familyMembers: true,
  evolutionNotes: { orderBy: { date: 'desc' } },
  documents: { orderBy: { uploadedAt: 'desc' } },
  subsystemRelations: { orderBy: { subsystem: 'asc' } },
  snapshots: { orderBy: { createdAt: 'desc' } },
  patient: { select: { patientType: { select: recordTypeSelect } } },
} satisfies Prisma.MedicalRecordInclude;

type RecordRow = Prisma.MedicalRecordGetPayload<{ include: typeof recordInclude }>;

export interface RecordTypeDto {
  id: string;
  name: string;
  template: RecordTemplate;
  familyMembersEnabled: boolean;
  subsystemRelationsEnabled: boolean;
}

export interface RecordSnapshotDto {
  id: string;
  createdAt: Date;
  patientTypeId: string;
  patientTypeName: string;
  template: RecordTemplate;
  data: RecordData;
}

type HiddenKey = 'nameTokens' | 'piiVersion' | 'patient' | 'data' | 'snapshots';

export type MedicalRecordDto = Omit<RecordRow, HiddenKey> & {
  data: RecordData;
  patientType: RecordTypeDto;
  snapshots: RecordSnapshotDto[];
};

const HIDDEN = new Set<string>([ 'nameTokens', 'piiVersion', 'patient', 'data', 'snapshots' ]);

export function toRecordDto(row: RecordRow): MedicalRecordDto {
  const visible = Object.fromEntries(Object.entries(row).filter(([ key ]) => !HIDDEN.has(key))) as Omit<RecordRow, HiddenKey>;
  const type = row.patient.patientType;
  return {
    ...visible,
    data: parseRecordData(row.data),
    patientType: { ...type, template: parseStoredTemplate(type.template) },
    snapshots: row.snapshots.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      patientTypeId: s.patientTypeId,
      patientTypeName: s.patientTypeName,
      template: parseStoredTemplate(s.template),
      data: parseRecordData(s.data),
    })),
  };
}
