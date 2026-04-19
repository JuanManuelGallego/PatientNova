import { CSSProperties } from "react";
import { FormValues, SEX_CFG } from "@/src/types/MedicalRecord";
import { DateTimePicker } from "./DateTimePicker";
import { CustomSelect } from "./CustomSelect";

type GeneralDataSectionProps = {
  form: FormValues;
  onChange: (key: keyof FormValues, value: string) => void;
};

const sectionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
};

export function GeneralDataSection({ form, onChange }: GeneralDataSectionProps) {
  return (
    <div style={sectionGridStyle}>
      <label className="form-label">
        Nombre completo
        <input
          className="form-input"
          type="text"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Nombre del paciente"
        />
      </label>
      <label className="form-label">
        Cédula
        <input
          className="form-input"
          type="text"
          value={form.nationalId}
          onChange={(e) => onChange("nationalId", e.target.value)}
          placeholder="Número de identificación"
        />
      </label>
      <label className="form-label">
        Sexo
        <CustomSelect
          value={form.sex}
          placeholder="Seleccionar sexo…"
          options={Object.entries(SEX_CFG).map(([ value, { label } ]) => ({ value, label }))}
          onChange={(v) => onChange("sex", v)}
        />
      </label>
      <label className="form-label">
        Fecha de nacimiento
        <DateTimePicker
          date={form.birthDate || undefined}
          onChanged={(date) => onChange("birthDate", date)}
        />
      </label>
      <label className="form-label">
        Edad
        <input
          className="form-input"
          type="text"
          value={form.age}
          onChange={(e) => onChange("age", e.target.value)}
          placeholder="Edad"
        />
      </label>
      <label className="form-label">
        Lugar de nacimiento
        <input
          className="form-input"
          type="text"
          value={form.birthPlace}
          onChange={(e) => onChange("birthPlace", e.target.value)}
          placeholder="Ciudad, departamento"
        />
      </label>
      <label className="form-label" style={{ gridColumn: "1 / -1" }}>
        Motivo de consulta
        <textarea
          className="form-input form-input--textarea"
          value={form.consultationReason}
          onChange={(e) => onChange("consultationReason", e.target.value)}
          placeholder="Escriba el motivo principal de consulta"
        />
      </label>
    </div>
  );
}