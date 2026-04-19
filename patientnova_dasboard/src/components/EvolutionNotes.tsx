import { CSSProperties } from "react";
import { createEmptyNote, EvolutionNote } from "@/src/types/MedicalRecord";
import { DateTimePicker } from "./DateTimePicker";
import { fmtDate } from "../utils/TimeUtils";

type EvolutionNotesProps = {
  evolutionNotes: EvolutionNote[];
  onChange: (evolutionNote: EvolutionNote[]) => void
};

const sectionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
};

export function EvolutionNotes({
  evolutionNotes,
  onChange,
}: EvolutionNotesProps) {
  function updateMember(i: number, field: keyof EvolutionNote, val: string) {
    onChange(evolutionNotes.map((m, idx) => (idx === i ? { ...m, [ field ]: val } : m)));
  }
  function addRow() { onChange([ createEmptyNote(), ...evolutionNotes ]); }
  function removeRow(i: number) { onChange(evolutionNotes.filter((_, idx) => idx !== i)); }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--c-gray-900)" }}>Notas de evolución</div>
        <button type="button" className="btn-primary" onClick={addRow}>
          Agregar nota de evolución
        </button>
      </div>
      <div style={{ display: "grid", gap: 18 }}>
        {evolutionNotes.map((note, index) => (
          <div
            key={`note-${index}`}
            style={{
              border: "1px solid var(--c-gray-200)",
              borderRadius: "16px",
              padding: 14,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 600, color: "var(--c-gray-900)" }}>
                Nota de evolución - {note.date ? fmtDate(note.date) : `#${index + 1}`}
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => removeRow(index)}
              >
                Eliminar
              </button>
            </div>
            <div style={sectionGridStyle}>
              <label className="form-label">
                Fecha
                <DateTimePicker
                  date={note.date || undefined}
                  onChanged={(date) => updateMember(index, "date", date)}
                />
              </label>
              <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                Nota
                <textarea
                  className="form-input form-input--textarea"
                  value={note.text}
                  onChange={(e) => updateMember(index, "text", e.target.value)}
                  placeholder="Escriba la nota de evolución después de la cita"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}