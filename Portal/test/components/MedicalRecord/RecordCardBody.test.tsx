import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecordCardBody } from "@/src/components/MedicalRecord/RecordCardBody";
import { MissingRequiredHint } from "@/src/components/MedicalRecord/MissingRequiredHint";
import { RecordSnapshots } from "@/src/components/MedicalRecord/RecordSnapshots";
import { createEmptyForm } from "@/src/types/MedicalRecord";
import type { RecordCard } from "@/src/utils/recordLayout";
import { fireEvent } from "@testing-library/react";

const handlers = { onIdentity: vi.fn(), onData: vi.fn(), onFamilyMembers: vi.fn(), onSubsystemRelations: vi.fn() };
const follows = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("RecordCardBody", () => {
  it("shows identity first, then the family table, the fields and the subsystem table, as the PDF does", () => {
    const card: RecordCard = {
      title: "Datos generales",
      fields: [ { key: "motivo", label: "Motivo", kind: "longText", required: false, removedAt: null } ],
      identity: true,
      familyTable: true,
      subsystemTable: true,
    };
    render(<RecordCardBody card={card} form={createEmptyForm()} {...handlers} />);

    const identity = screen.getByTestId("general-data-name-input");
    const family = screen.getByTestId("family-table-add-button");
    const field = screen.getByTestId("record-field-motivo");
    const subsystems = screen.getByText("Relación entre subsistemas");
    expect(follows(identity, family)).toBe(true);
    expect(follows(family, field)).toBe(true);
    expect(follows(field, subsystems)).toBe(true);
  });
});

describe("MissingRequiredHint", () => {
  it("is a notice, not an error, and lists the labels", () => {
    render(<MissingRequiredHint labels={[ "Motivo", "Objetivo" ]} />);
    const hint = screen.getByTestId("medical-records-missing-required");
    expect(hint).toHaveTextContent("Campos obligatorios sin completar: Motivo, Objetivo");
    expect(hint).toHaveClass("info-banner");
    expect(hint).not.toHaveClass("error-inline");
  });

  it("renders nothing when nothing is missing", () => {
    const { container } = render(<MissingRequiredHint labels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RecordSnapshots keys", () => {
  it("renders sections that share a title, and one named Otros, without key collisions", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const field = (key: string) => ({ key, label: key, kind: "longText" as const, required: false, removedAt: null });
    render(<RecordSnapshots snapshots={[ {
      id: "s1", createdAt: "2026-11-20T15:00:00.000Z", patientTypeId: "t", patientTypeName: "Individual",
      template: { sections: [ { title: "Otros", fields: [ field("a") ] }, { title: "Otros", fields: [ field("b") ] } ] },
      data: { a: "1", b: "2", suelto: "3" },
    } ]} />);
    fireEvent.click(screen.getByRole("button", { name: /Individual/ }));

    expect(screen.getAllByRole("heading", { name: "Otros" })).toHaveLength(3);
    expect(errors.mock.calls.some((c) => String(c[ 0 ]).includes("same key"))).toBe(false);
    errors.mockRestore();
  });
});
