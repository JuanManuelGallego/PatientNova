import { describe, expect, it } from "vitest";
import { missingRequired, previousFields, recordLayout } from "@/src/utils/recordLayout";
import type { RecordTemplate, TemplateField } from "@/src/types/PatientType";

const REMOVED = "2026-11-28T00:00:00.000Z";
const f = (key: string, label: string, extra: Partial<TemplateField> = {}): TemplateField =>
  ({ key, label, kind: "longText", required: false, removedAt: null, ...extra });
const gone = (key: string, label: string) => f(key, label, { removedAt: REMOVED });

// Copies of the Server's INDIVIDUAL_/FAMILY_TEMPLATE_WITH_LEGACY (the Portal can't import Server code).
const INDIVIDUAL: RecordTemplate = {
  sections: [
    { title: "Datos generales", fields: [ f("consultationReason", "Motivo de consulta") ] },
    { title: "Composición familiar", fields: [ f("familyObservations", "Observaciones") ] },
    {
      title: "Antecedentes",
      fields: [
        f("earlyDevelopment", "Desarrollo temprano"), f("schoolAndWork", "Escolar y laboral"),
        f("lifestyleHabits", "Hábitos y estilo de vida"), f("traumaticEvents", "Eventos traumáticos o estresores previos"),
        f("emotionalConsiderations", "Consideraciones emocionales"), f("physicalConsiderations", "Consideraciones físicas, etiología y de salud"),
        f("mentalHistory", "Antecedentes mentales"), f("objective", "Objetivo"),
      ],
    },
    { title: "Aspectos específicos de la familia", fields: [ gone("familyType", "Tipo de familia"), gone("genogram", "Genograma") ] },
  ],
};

const FAMILIA: RecordTemplate = {
  sections: [
    { title: "Datos generales", fields: [ f("consultationReason", "Motivo de consulta") ] },
    { title: "Aspectos específicos de la familia", fields: [ f("familyType", "Tipo de familia"), f("genogram", "Genograma") ] },
    { title: "Composición familiar", fields: [ gone("familyObservations", "Observaciones") ] },
    { title: "Antecedentes", fields: [ gone("earlyDevelopment", "Desarrollo temprano"), gone("objective", "Objetivo") ] },
  ],
};

const shape = (cards: ReturnType<typeof recordLayout>) =>
  cards.map((c) => ({ title: c.title, fields: c.fields.length, identity: c.identity, familyTable: c.familyTable, subsystemTable: c.subsystemTable }));

describe("recordLayout", () => {
  it("reproduces today's individual form", () => {
    expect(shape(recordLayout(INDIVIDUAL, { familyMembers: true, subsystemRelations: false }))).toEqual([
      { title: "Datos generales", fields: 1, identity: true, familyTable: false, subsystemTable: false },
      { title: "Composición familiar", fields: 1, identity: false, familyTable: true, subsystemTable: false },
      { title: "Antecedentes", fields: 8, identity: false, familyTable: false, subsystemTable: false },
    ]);
  });

  it("reproduces today's family form, inserting the family table after the first card", () => {
    expect(shape(recordLayout(FAMILIA, { familyMembers: true, subsystemRelations: true }))).toEqual([
      { title: "Datos generales", fields: 1, identity: true, familyTable: false, subsystemTable: false },
      { title: "Composición familiar", fields: 0, identity: false, familyTable: true, subsystemTable: false },
      { title: "Aspectos específicos de la familia", fields: 2, identity: false, familyTable: false, subsystemTable: true },
    ]);
  });

  it("puts every fixed block on one card when the template has no sections", () => {
    expect(shape(recordLayout({ sections: [] }, { familyMembers: true, subsystemRelations: true }))).toEqual([
      { title: "Datos generales", fields: 0, identity: true, familyTable: true, subsystemTable: true },
    ]);
  });

  it("drops later sections whose fields were all removed, keeping the first as the identity card", () => {
    const template: RecordTemplate = { sections: [ { title: "Vieja", fields: [ gone("x", "X") ] }, { title: "Otra", fields: [ gone("y", "Y") ] } ] };
    expect(shape(recordLayout(template, { familyMembers: false, subsystemRelations: false }))).toEqual([
      { title: "Vieja", fields: 0, identity: true, familyTable: false, subsystemTable: false },
    ]);
  });

  it("keeps the first section as the identity card when its own fields were all removed", () => {
    const template: RecordTemplate = {
      sections: [ { ...INDIVIDUAL.sections[ 0 ]!, fields: [ gone("consultationReason", "Motivo de consulta") ] }, ...INDIVIDUAL.sections.slice(1) ],
    };
    expect(shape(recordLayout(template, { familyMembers: true, subsystemRelations: false })).slice(0, 2)).toEqual([
      { title: "Datos generales", fields: 0, identity: true, familyTable: false, subsystemTable: false },
      { title: "Composición familiar", fields: 1, identity: false, familyTable: true, subsystemTable: false },
    ]);
  });

  it("matches the family section title ignoring case and spaces", () => {
    const template: RecordTemplate = { sections: [ { title: "Motivo", fields: [ f("m", "M") ] }, { title: "  composición FAMILIAR ", fields: [] } ] };
    expect(shape(recordLayout(template, { familyMembers: true, subsystemRelations: false })).map((c) => [ c.title.trim(), c.familyTable ])).toEqual([
      [ "Motivo", false ],
      [ "composición FAMILIAR", true ],
    ]);
  });
});

describe("previousFields", () => {
  it("lists values of removed fields with their label, then unknown keys under their raw key", () => {
    expect(previousFields(FAMILIA, { consultationReason: "a", zzz: "c", earlyDevelopment: "b", objective: "", aaa: "d" })).toEqual([
      { key: "earlyDevelopment", label: "Desarrollo temprano", value: "b" },
      { key: "aaa", label: "aaa", value: "d" },
      { key: "zzz", label: "zzz", value: "c" },
    ]);
  });
});

describe("missingRequired", () => {
  it("lists active required fields with no value", () => {
    const template: RecordTemplate = {
      sections: [ {
        title: "S",
        fields: [ f("a", "Vacío", { required: true }), f("b", "Lleno", { required: true }), f("c", "Quitado", { required: true, removedAt: REMOVED }), f("d", "Opcional") ],
      } ],
    };
    expect(missingRequired(template, { b: "x", a: "  " })).toEqual([ "Vacío" ]);
  });
});
