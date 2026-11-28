import { sectionGridStyle } from "@/src/config/layout";
import type { FamilyMember, FormValues, SubsystemRelation } from "@/src/types/MedicalRecord";
import type { RecordCard } from "@/src/utils/recordLayout";
import { FamilyTable } from "../FamilyTable";
import { GeneralDataSection, type IdentityKey } from "./GeneralDataSection";
import { SubsystemRelationsTable } from "./SubsystemRelationsTable";
import { TemplateFields } from "./TemplateFields";

type RecordCardBodyProps = {
  card: RecordCard;
  form: FormValues;
  onIdentity: (key: IdentityKey, value: string) => void;
  onData: (key: string, value: string) => void;
  onFamilyMembers: (members: FamilyMember[]) => void;
  onSubsystemRelations: (relations: SubsystemRelation[]) => void;
};

/** Same block order as the PDF. */
export function RecordCardBody({ card, form, onIdentity, onData, onFamilyMembers, onSubsystemRelations }: RecordCardBodyProps) {
  const hasGrid = card.fields.length > 0 || card.subsystemTable;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {card.identity && (
        <div style={sectionGridStyle}>
          <GeneralDataSection form={form} onChange={onIdentity} />
        </div>
      )}
      {card.familyTable && <FamilyTable familyMembers={form.familyMembers ?? []} onChange={onFamilyMembers} />}
      {hasGrid && (
        <div style={sectionGridStyle}>
          <TemplateFields fields={card.fields} data={form.data} onChange={onData} />
          {card.subsystemTable && (
            <div style={{ gridColumn: "1 / -1" }}>
              <span className="form-label">Relación entre subsistemas</span>
              <SubsystemRelationsTable relations={form.subsystemRelations || []} onChange={onSubsystemRelations} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
