export interface ConsentVersion {
  id: string;
  version: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

export type TemplateFieldKind = "text" | "longText";

export interface TemplateField {
  key: string;
  label: string;
  kind: TemplateFieldKind;
  required: boolean;
  removedAt: string | null;
}

export interface TemplateSection {
  title: string;
  fields: TemplateField[];
}

export interface RecordTemplate {
  sections: TemplateSection[];
}

export interface PatientType {
  id: string;
  name: string;
  isDefault: boolean;
  template: RecordTemplate;
  patientCount: number;
  currentVersion: ConsentVersion | null;
  familyMembersEnabled: boolean;
  subsystemRelationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
