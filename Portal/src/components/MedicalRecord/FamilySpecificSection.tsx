import { FormValues, SubsystemRelation } from "@/src/types/MedicalRecord";
import { sectionGridStyle } from "@/src/config/antTheme";
import { SubsystemRelationsTable } from "./SubsystemRelationsTable";

type FamilySpecificSectionProps = {
    form: FormValues;
    onChange: (key: keyof FormValues, value: string | SubsystemRelation[]) => void;
};

export function FamilySpecificSection({ form, onChange }: FamilySpecificSectionProps) {
    return (
        <div style={sectionGridStyle}>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Tipo de familia
                <textarea
                    className="form-input form-input--textarea"
                    value={form.familyType}
                    onChange={(e) => onChange("familyType", e.target.value)}
                    placeholder="Describa el tipo de familia"
                    data-testid="family-specific-family-type-input"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Ciclo vital
                <textarea
                    className="form-input form-input--textarea"
                    value={form.lifecycle}
                    onChange={(e) => onChange("lifecycle", e.target.value)}
                    placeholder="Ciclo vital: noviazgo, matrimonio sin hijos, hijos pequeños, hijos adolescentes, hijos adultos, nido vacío, jubilación o vejez"
                    data-testid="family-specific-lifecycle-input"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Genograma
                <textarea
                    className="form-input form-input--textarea"
                    value={form.genogram}
                    onChange={(e) => onChange("genogram", e.target.value)}
                    placeholder="Relaciones entre ellos"
                    data-testid="family-specific-genogram-input"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Recursos que tienen
                <textarea
                    className="form-input form-input--textarea"
                    value={form.resources}
                    onChange={(e) => onChange("resources", e.target.value)}
                    placeholder="Describa los recursos con los que cuenta la familia (apoyo social, económico, emocional, etc.)"
                    data-testid="family-specific-resources-input"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Dificultades tienen
                <textarea
                    className="form-input form-input--textarea"
                    value={form.difficulties}
                    onChange={(e) => onChange("difficulties", e.target.value)}
                    placeholder="Describa las dificultades con las que se enfrenta la familia"
                    data-testid="family-specific-difficulties-input"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Comunicación
                <textarea
                    className="form-input form-input--textarea"
                    value={form.communication}
                    onChange={(e) => onChange("communication", e.target.value)}
                    placeholder="Detalles de la comunicación"
                    data-testid="family-specific-communication-input"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Reglas
                <textarea
                    className="form-input form-input--textarea"
                    value={form.rule}
                    onChange={(e) => onChange("rule", e.target.value)}
                    placeholder="Claras, implícitas, explicitas, incongruentes, inconsistentes"
                    data-testid="family-specific-rule-input"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Limites
                <textarea
                    className="form-input form-input--textarea"
                    value={form.limits}
                    onChange={(e) => onChange("limits", e.target.value)}
                    placeholder="Flexible, difusos, rígidos"
                    data-testid="family-specific-limits-input"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Relacion entre subsistemas
            </label>
            <div style={{ gridColumn: "1 / -1" }}>
                <SubsystemRelationsTable
                    relations={form.subsystemRelations || []}
                    onChange={(relations) => onChange("subsystemRelations", relations)}
                />
            </div>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Contexto familiar
                <textarea
                    className="form-input form-input--textarea"
                    value={form.familyContext}
                    onChange={(e) => onChange("familyContext", e.target.value)}
                    placeholder="Ambiente, Redes sociales, Redes de apoyo ..."
                    data-testid="family-specific-family-context-input"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Expectativas
                <textarea
                    className="form-input form-input--textarea"
                    value={form.expectations}
                    onChange={(e) => onChange("expectations", e.target.value)}
                    placeholder="Expectativas de la familia"
                    data-testid="family-specific-expectations-input"
                />
            </label>
            <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Flexibilidad al cambio
                <textarea
                    className="form-input form-input--textarea"
                    value={form.flexibility}
                    onChange={(e) => onChange("flexibility", e.target.value)}
                    placeholder="Detalles sobre la flexibilidad al cambio de la familia"
                    data-testid="family-specific-flexibility-input"
                />
            </label>
        </div>
    );
}