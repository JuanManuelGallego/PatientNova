import { useState } from "react";
import type { RecordSnapshot } from "@/src/types/MedicalRecord";
import { fmtDate } from "@/src/utils/TimeUtils";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { SELECT_ICONS } from "@/src/config/icons";
import { MedicalRecordCard } from "./MedicalRecordCard";
import { ReadOnlyValues, type ReadOnlyValue } from "./ReadOnlyValues";

/** Every answer of a snapshot, labelled from the template stored with it (removed fields included), then unknown keys. */
function snapshotValues({ template, data }: RecordSnapshot): { title: string; items: ReadOnlyValue[] }[] {
  const known = new Set<string>();
  const groups = template.sections.map((section) => ({
    title: section.title,
    items: section.fields.flatMap((f) => {
      known.add(f.key);
      return data[ f.key ] ? [ { key: f.key, label: f.label, value: data[ f.key ]! } ] : [];
    }),
  }));
  const unknown = Object.keys(data).filter((k) => !known.has(k) && data[ k ]).sort().map((k) => ({ key: k, label: k, value: data[ k ]! }));
  return [ ...groups, { title: "Otros", items: unknown } ].filter((g) => g.items.length > 0);
}

function SnapshotEntry({ snapshot }: { snapshot: RecordSnapshot }) {
  const timezone = useDisplayTimezone();
  const [ open, setOpen ] = useState(false);
  const Chevron = SELECT_ICONS.chevronDown;
  return (
    <div style={{ borderTop: "1px solid var(--c-gray-200)", paddingTop: 12 }} data-testid="record-snapshot">
      <button
        type="button"
        className="btn-secondary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "space-between" }}
      >
        <span>{snapshot.patientTypeName} · archivada el {fmtDate(snapshot.createdAt, timezone)}</span>
        <Chevron size={16} style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden />
      </button>
      {open && (
        <div style={{ display: "grid", gap: 20, padding: "16px 0 4px" }}>
          {snapshotValues(snapshot).map((group, i) => (
            <section key={i}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>{group.title}</h3>
              <ReadOnlyValues items={group.items} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Payloads archived when the patient changed type: read-only, only in the record view. */
export function RecordSnapshots({ snapshots }: { snapshots: RecordSnapshot[] }) {
  if (snapshots.length === 0) return null;
  return (
    <MedicalRecordCard title="Historias archivadas">
      <p className="dash-empty__text" style={{ marginTop: -8, marginBottom: 12 }}>
        Datos guardados antes de cambiar el tipo de paciente. Solo lectura.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {snapshots.map((s) => <SnapshotEntry key={s.id} snapshot={s} />)}
      </div>
    </MedicalRecordCard>
  );
}
