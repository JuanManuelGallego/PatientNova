import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateFields } from "@/src/components/MedicalRecord/TemplateFields";
import { PreviousFields } from "@/src/components/MedicalRecord/PreviousFields";
import { RecordSnapshots } from "@/src/components/MedicalRecord/RecordSnapshots";
import type { TemplateField } from "@/src/types/PatientType";
import type { RecordSnapshot } from "@/src/types/MedicalRecord";

const field = (key: string, label: string, extra: Partial<TemplateField> = {}): TemplateField =>
  ({ key, label, kind: "longText", required: false, removedAt: null, ...extra });

describe("TemplateFields", () => {
  it("renders one box per field with its label and value, and a star for required ones", () => {
    render(
      <TemplateFields
        fields={[ field("motivo", "Motivo de consulta", { required: true }), field("ciudad", "Ciudad", { kind: "text" }) ]}
        data={{ motivo: "Duelo" }}
        onChange={() => {}}
      />,
    );
    const motivo = screen.getByRole("textbox", { name: /Motivo de consulta/ });
    expect(motivo.tagName).toBe("TEXTAREA");
    expect(motivo).toHaveValue("Duelo");
    expect(screen.getByRole("textbox", { name: "Ciudad" }).tagName).toBe("INPUT");
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByTestId("record-field-ciudad")).toHaveValue("");
  });

  it("reports the key and the new value", () => {
    const onChange = vi.fn();
    render(<TemplateFields fields={[ field("motivo", "Motivo") ]} data={{}} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("record-field-motivo"), { target: { value: "x" } });
    expect(onChange).toHaveBeenCalledWith("motivo", "x");
  });
});

describe("PreviousFields", () => {
  it("shows removed values read-only", () => {
    render(<PreviousFields items={[ { key: "earlyDevelopment", label: "Desarrollo temprano", value: "Normal" } ]} />);
    expect(screen.getByText("Campos anteriores")).toBeInTheDocument();
    expect(screen.getByText("Desarrollo temprano")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("renders nothing without items", () => {
    const { container } = render(<PreviousFields items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RecordSnapshots", () => {
  const snapshot: RecordSnapshot = {
    id: "s1",
    createdAt: "2026-11-20T15:00:00.000Z",
    patientTypeId: "t1",
    patientTypeName: "Individual",
    template: {
      sections: [ {
        title: "Antecedentes",
        fields: [ field("objective", "Objetivo"), field("viejo", "Campo quitado", { removedAt: "2026-01-01T00:00:00.000Z" }) ],
      } ],
    },
    data: { objective: "Reducir ansiedad", viejo: "antes", sinPlantilla: "suelto" },
  };

  it("lists each snapshot by type and shows its values read-only once opened", () => {
    render(<RecordSnapshots snapshots={[ snapshot ]} />);
    expect(screen.getByText("Historias archivadas")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Individual/ });
    expect(screen.queryByText("Reducir ansiedad")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Objetivo")).toBeInTheDocument();
    expect(screen.getByText("Reducir ansiedad")).toBeInTheDocument();
    expect(screen.getByText("Campo quitado")).toBeInTheDocument();
    expect(screen.getByText("sinPlantilla")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("renders nothing without snapshots", () => {
    const { container } = render(<RecordSnapshots snapshots={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
