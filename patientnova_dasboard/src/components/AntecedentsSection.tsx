import { FormValues } from "@/src/types/MedicalRecord";
import { sectionGridStyle } from "../styles/theme";

type AntecedentsSectionProps = {
    form: FormValues;
    onChange: (key: keyof FormValues, value: string) => void;
};

export function AntecedentsSection({ form, onChange }: AntecedentsSectionProps) {
    return (
        <div style={sectionGridStyle}>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Desarrollo temprano
                <textarea
                    className="form-input form-input--textarea"
                    value={form.earlyDevelopment}
                    onChange={(e) => onChange("earlyDevelopment", e.target.value)}
                    placeholder="Describa el desarrollo temprano"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Escolar y laboral
                <textarea
                    className="form-input form-input--textarea"
                    value={form.schoolAndWork}
                    onChange={(e) => onChange("schoolAndWork", e.target.value)}
                    placeholder="Información escolar y laboral"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Hábitos y estilo de vida
                <textarea
                    className="form-input form-input--textarea"
                    value={form.lifestyleHabits}
                    onChange={(e) => onChange("lifestyleHabits", e.target.value)}
                    placeholder="Hábitos diarios y estilo de vida"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Eventos traumáticos o estresores previos
                <textarea
                    className="form-input form-input--textarea"
                    value={form.traumaticEvents}
                    onChange={(e) => onChange("traumaticEvents", e.target.value)}
                    placeholder="Eventos traumáticos o estresores previos"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Consideraciones emocionales
                <textarea
                    className="form-input form-input--textarea"
                    value={form.emotionalConsiderations}
                    onChange={(e) => onChange("emotionalConsiderations", e.target.value)}
                    placeholder="Consideraciones emocionales"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Consideraciones físicas, etiología y de salud
                <textarea
                    className="form-input form-input--textarea"
                    value={form.physicalConsiderations}
                    onChange={(e) => onChange("physicalConsiderations", e.target.value)}
                    placeholder="Detalles físicos, etiología y salud"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Antecedentes mentales
                <textarea
                    className="form-input form-input--textarea"
                    value={form.mentalHistory}
                    onChange={(e) => onChange("mentalHistory", e.target.value)}
                    placeholder="Antecedentes mentales"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Objetivo
                <textarea
                    className="form-input form-input--textarea"
                    value={form.objective}
                    onChange={(e) => onChange("objective", e.target.value)}
                    placeholder="Objetivo clínico"
                />
            </label>
        </div>
    );
}