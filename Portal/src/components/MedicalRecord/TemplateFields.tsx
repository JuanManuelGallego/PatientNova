import type { TemplateField } from "@/src/types/PatientType";
import type { RecordData } from "@/src/types/MedicalRecord";
import { RequiredField } from "../Info/Required";

type TemplateFieldsProps = {
  fields: TemplateField[];
  data: RecordData;
  onChange: (key: string, value: string) => void;
};

export function TemplateFields({ fields, data, onChange }: TemplateFieldsProps) {
  return (
    <>
      {fields.map((field) => {
        const common = {
          value: data[ field.key ] ?? "",
          "data-testid": `record-field-${field.key}`,
        };
        return (
          <label key={field.key} className="form-label" style={{ gridColumn: "1 / -1" }}>
            {field.required ? <RequiredField label={field.label} /> : field.label}
            {field.kind === "text" ? (
              <input className="form-input" type="text" {...common} onChange={(e) => onChange(field.key, e.target.value)} />
            ) : (
              <textarea className="form-input form-input--textarea" {...common} onChange={(e) => onChange(field.key, e.target.value)} />
            )}
          </label>
        );
      })}
    </>
  );
}
