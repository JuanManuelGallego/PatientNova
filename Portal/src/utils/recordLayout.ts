import type { RecordTemplate, TemplateField } from "@/src/types/PatientType";
import type { RecordData } from "@/src/types/MedicalRecord";

/** One card of the record page (and one block of the PDF), in display order. */
export interface RecordCard {
  title: string;
  /** Active fields only. */
  fields: TemplateField[];
  /** Identity fields (name, cédula, sex, birth date and place) at the top. */
  identity: boolean;
  /** Family members table, above the fields. */
  familyTable: boolean;
  /** Subsystem relations table, below the fields. */
  subsystemTable: boolean;
}

const GENERAL_TITLE = "Datos generales";
const FAMILY_TITLE = "Composición familiar";
const isFamilyTitle = (title: string) => title.trim().toLocaleLowerCase("es") === FAMILY_TITLE.toLocaleLowerCase("es");

const card = (title: string, fields: TemplateField[] = []): RecordCard =>
  ({ title, fields, identity: false, familyTable: false, subsystemTable: false });

/**
 * Lays the template out with the blocks every record keeps: identity on the first section's card, the family table at the top of
 * a "Composición familiar" section (else in its own card after the first), the subsystem table on the last card.
 */
export function recordLayout(template: RecordTemplate, opts: { familyMembers: boolean; subsystemRelations: boolean }): RecordCard[] {
  const sections = template.sections.map((s) => card(s.title, s.fields.filter((f) => f.removedAt === null)));
  // A section left with only removed fields is gone from the form, so it can't anchor the family table.
  const familyAt = opts.familyMembers
    ? template.sections.findIndex((s, i) => isFamilyTitle(s.title) && (s.fields.length === 0 || sections[ i ]!.fields.length > 0))
    : -1;
  if (familyAt >= 0) sections[ familyAt ]!.familyTable = true;

  // The first section always stays: it holds the identity fields even when its own fields were all removed.
  const cards = sections.filter((s, i) => i === 0 || s.fields.length > 0 || s.familyTable);
  if (cards.length === 0) cards.push({ ...card(GENERAL_TITLE), familyTable: opts.familyMembers });
  else if (opts.familyMembers && familyAt < 0) cards.splice(1, 0, { ...card(FAMILY_TITLE), familyTable: true });
  cards[ 0 ]!.identity = true;
  if (opts.subsystemRelations) cards[ cards.length - 1 ]!.subsystemTable = true;
  return cards;
}

export interface PreviousField {
  key: string;
  label: string;
  value: string;
}

/** Values of removed fields (labelled from the template), then keys the template doesn't know (labelled by key). */
export function previousFields(template: RecordTemplate, data: RecordData): PreviousField[] {
  const fields = template.sections.flatMap((s) => s.fields);
  const known = new Set(fields.map((f) => f.key));
  const removed = fields
    .filter((f) => f.removedAt !== null && data[ f.key ])
    .map((f) => ({ key: f.key, label: f.label, value: data[ f.key ]! }));
  const unknown = Object.keys(data)
    .filter((key) => !known.has(key) && data[ key ])
    .sort()
    .map((key) => ({ key, label: key, value: data[ key ]! }));
  return [ ...removed, ...unknown ];
}

/** Labels of active required fields left empty (a hint only: saves are never refused). */
export function missingRequired(template: RecordTemplate, data: RecordData): string[] {
  return template.sections
    .flatMap((s) => s.fields)
    .filter((f) => f.removedAt === null && f.required && !data[ f.key ]?.trim())
    .map((f) => f.label);
}
