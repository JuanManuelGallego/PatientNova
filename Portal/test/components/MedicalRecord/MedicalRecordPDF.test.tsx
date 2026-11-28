import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { RecordTemplate, TemplateField } from "@/src/types/PatientType";
import { createEmptyForm, type RecordPatientType } from "@/src/types/MedicalRecord";

// The PDF primitives as plain elements, so the document renders as DOM text.
vi.mock("@react-pdf/renderer", () => {
  const box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Document: box,
    Page: box,
    View: box,
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Image: () => null,
    StyleSheet: { create: <T,>(s: T) => s },
    pdf: vi.fn(),
  };
});

const { MedicalRecordPDF } = await import("@/src/components/MedicalRecord/MedicalRecordPDF");

const f = (key: string, label: string, removedAt: string | null = null): TemplateField =>
  ({ key, label, kind: "longText", required: false, removedAt });

const typeOf = (template: RecordTemplate, family: boolean): RecordPatientType =>
  ({ id: "t", name: "T", template, familyMembersEnabled: true, subsystemRelationsEnabled: family });

describe("MedicalRecordPDF", () => {
  it("prints the active fields of the template, never removed or unknown ones", () => {
    const template: RecordTemplate = {
      sections: [
        { title: "Datos generales", fields: [ f("consultationReason", "Motivo de consulta") ] },
        { title: "Aspectos específicos de la familia", fields: [ f("genogram", "Genograma") ] },
        { title: "Antecedentes", fields: [ f("earlyDevelopment", "Desarrollo temprano", "2026-11-28T00:00:00.000Z") ] },
      ],
    };
    const form = { ...createEmptyForm(), data: { consultationReason: "Motivo", genogram: "GENO", earlyDevelopment: "ANTIGUO", suelto: "SUELTO" } };

    render(<MedicalRecordPDF form={form} type={typeOf(template, true)} user={null} />);

    expect(screen.getByText("Genograma")).toBeInTheDocument();
    expect(screen.getByText("GENO")).toBeInTheDocument();
    expect(screen.getByText("Aspectos específicos de la familia")).toBeInTheDocument();
    expect(screen.getByText("Relación entre subsistemas")).toBeInTheDocument();
    expect(screen.queryByText("ANTIGUO")).toBeNull();
    expect(screen.queryByText("Desarrollo temprano")).toBeNull();
    expect(screen.queryByText("SUELTO")).toBeNull();
  });

  it("prints Observaciones inside Composición familiar for the individual template", () => {
    const template: RecordTemplate = {
      sections: [
        { title: "Datos generales", fields: [ f("consultationReason", "Motivo de consulta") ] },
        { title: "Composición familiar", fields: [ f("familyObservations", "Observaciones") ] },
      ],
    };
    const form = { ...createEmptyForm(), data: { familyObservations: "OBS" } };

    render(<MedicalRecordPDF form={form} type={typeOf(template, false)} user={null} />);

    expect(screen.getByText("Composición familiar")).toBeInTheDocument();
    expect(screen.getByText("No se registraron miembros familiares.")).toBeInTheDocument();
    expect(screen.getByText("OBS")).toBeInTheDocument();
    expect(screen.queryByText("Relación entre subsistemas")).toBeNull();
  });
});
