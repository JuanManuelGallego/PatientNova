import { sectionGridStyle } from "@/src/config/antTheme";
import { createEmptyMember, FamilyMember, RELATIONSHIP_CFG, SEX_CFG } from "@/src/types/MedicalRecord";
import { CustomSelect } from "./CustomSelect";

type FamilyTableProps = {
  familyMembers: FamilyMember[];
  onChange: (familyMembers: FamilyMember[]) => void;
};

export function FamilyTable({
  familyMembers,
  onChange,
}: FamilyTableProps) {
  function updateMember(i: number, field: keyof FamilyMember, val: string) {
    onChange(familyMembers.map((m, idx) => (idx === i ? { ...m, [ field ]: val } : m)));
  }
  function addRow() { onChange([ ...familyMembers, createEmptyMember() ]); }
  function removeRow(i: number) { onChange(familyMembers.filter((_, idx) => idx !== i)); }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--c-gray-900)" }}>Miembros de la familia</div>
        <button type="button" className="btn-primary" onClick={addRow} data-testid="family-table-add-button">
          Agregar miembro
        </button>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {familyMembers.map((member, index) => (
          <div
            key={`family-${index}`}
            data-testid={`family-member-${index}`}
            style={{
              border: "1px solid var(--c-gray-200)",
              borderRadius: "16px",
              padding: 14,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 600, color: "var(--c-gray-900)" }}>{member.relationship ? RELATIONSHIP_CFG[ member.relationship ].label : `Miembro ${index + 1}`}</div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => removeRow(index)}
                  data-testid={`family-member-delete-${index}`}
                >
                  Eliminar
                </button>
            </div>
            <div style={sectionGridStyle}>
              <label className="form-label">
                Nombre
                <input
                  className="form-input"
                  type="text"
                  value={member.name}
                  onChange={(e) => updateMember(index, "name", e.target.value)}
                  placeholder="Nombre"
                  data-testid={`family-member-name-${index}`}
                />
              </label>
              <label className="form-label">
                Sexo
                <CustomSelect
                  value={member.sex}
                  placeholder="Seleccionar sexo…"
                  options={Object.entries(SEX_CFG).map(([ value, { label } ]) => ({ value, label }))}
                  onChange={(v) => updateMember(index, "sex", v)}
                  data-testid={`family-member-sex-${index}`}
                />
              </label>
              <label className="form-label">
                Edad
                <input
                  className="form-input"
                  type="text"
                  value={member.age}
                  onChange={(e) => updateMember(index, "age", e.target.value)}
                  placeholder="Edad"
                  data-testid={`family-member-age-${index}`}
                />
              </label>
              <label className="form-label">
                Parentesco
                <CustomSelect
                  value={member.relationship}
                  placeholder="Seleccionar parentesco…"
                  options={Object.entries(RELATIONSHIP_CFG).map(([ value, { label } ]) => ({ value, label }))}
                  onChange={(v) => updateMember(index, "relationship", v)}
                  data-testid={`family-member-relationship-${index}`}
                />
              </label>
              <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Relación
                <input
                  className="form-input"
                  type="text"
                  value={member.relation}
                  onChange={(e) => updateMember(index, "relation", e.target.value)}
                  placeholder="Descripción de la relación"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}