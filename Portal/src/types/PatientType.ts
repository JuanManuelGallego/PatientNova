/** A consent PDF version: metadata only, the bytes are downloaded on demand. */
export interface ConsentVersion {
  id: string;
  version: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  /** The public link patients receive, built by the server. */
  url: string;
}

/** A provider's patient type: sets the record template and the consent PDF of its patients. */
export interface PatientType {
  id: string;
  name: string;
  isDefault: boolean;
  /** Patients of this type, soft-deleted ones included (a type in use cannot be deleted). */
  patientCount: number;
  currentVersion: ConsentVersion | null;
  familyMembersEnabled: boolean;
  subsystemRelationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
