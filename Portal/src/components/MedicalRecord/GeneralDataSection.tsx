import { FormValues, SEX_CFG } from "@/src/types/MedicalRecord";
import { DateTimePicker } from "../DateTimePicker";
import { CustomSelect } from "../CustomSelect";
import { getAge } from "@/src/utils/TimeUtils";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";

export type IdentityKey = "name" | "nationalId" | "sex" | "birthDate" | "birthPlace";

type GeneralDataSectionProps = {
  form: Pick<FormValues, IdentityKey>;
  onChange: (key: IdentityKey, value: string) => void;
};

/** The identity fields every record keeps, whatever its patient type. */
export function GeneralDataSection({ form, onChange }: GeneralDataSectionProps) {
  const timezone = useDisplayTimezone();
  return (
    <>
      <label className="form-label">
        Nombre completo
        <input
          className="form-input"
          type="text"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Nombre del paciente"
          data-testid="general-data-name-input"
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
          data-testid="general-data-national-id-input"
        />
      </label>
      <label className="form-label">
        Sexo
        <CustomSelect
          value={form.sex}
          placeholder="Seleccionar sexo…"
          options={Object.entries(SEX_CFG).map(([ value, { label } ]) => ({ value, label }))}
          onChange={(v) => onChange("sex", v)}
          data-testid="general-data-sex-select"
        />
      </label>
      <label className="form-label">
        Fecha de nacimiento
        <DateTimePicker
          date={form.birthDate || undefined}
          mode="calendarDay"
          onChange={(date) => onChange("birthDate", date)}
          data-testid="general-data-birth-date-input"
        />
      </label>
      <label className="form-label">
        Edad
        <input
          className="form-input"
          type="text"
          value={form.birthDate ? (getAge(form.birthDate, timezone) ?? "—") : "—"}
          readOnly
          disabled
          placeholder="Edad"
          data-testid="general-data-birth-age-display"
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
          data-testid="general-data-birth-place-input"
        />
      </label>
    </>
  );
}