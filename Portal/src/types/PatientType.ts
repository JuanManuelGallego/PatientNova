export interface ConsentVersion {
  id: string;
  version: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

export interface PatientType {
  id: string;
  name: string;
  isDefault: boolean;
  patientCount: number;
  currentVersion: ConsentVersion | null;
  familyMembersEnabled: boolean;
  subsystemRelationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
