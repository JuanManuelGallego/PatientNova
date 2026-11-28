import type { PreviousField } from "@/src/utils/recordLayout";
import { MedicalRecordCard } from "./MedicalRecordCard";
import { ReadOnlyValues } from "./ReadOnlyValues";

export function PreviousFields({ items }: { items: PreviousField[] }) {
  if (items.length === 0) return null;
  return (
    <MedicalRecordCard title="Campos anteriores">
      <p className="dash-empty__text" style={{ marginTop: -8, marginBottom: 16 }}>
        Estos campos ya no están en la plantilla. Se conservan solo para consulta.
      </p>
      <div data-testid="record-previous-fields">
        <ReadOnlyValues items={items} />
      </div>
    </MedicalRecordCard>
  );
}
