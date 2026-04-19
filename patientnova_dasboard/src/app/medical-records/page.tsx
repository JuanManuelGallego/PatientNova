"use client";
import { Suspense, useState, useEffect } from "react";

import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Requiered";
import { getPatientFullName } from "@/src/utils/AvatarHelper";
import { FormValues } from "@/src/types/MedicalRecord";
import { GeneralDataSection } from "@/src/components/GeneralDataSection";
import { FamilyTable } from "@/src/components/FamilyTable";
import { AntecedentsSection } from "@/src/components/AntecedentsSection";
import { EvolutionNotes } from "@/src/components/EvolutionNotes";
import { todayString } from "@/src/utils/TimeUtils";
import { parseAsString, useQueryState } from "nuqs";
import { LoadingSpinner } from "@/src/components/LoadingSpinner";
import { MedicalRecordCard } from "@/src/components/MedicalRecordCard";
import { useFetchMedicalRecord } from "@/src/api/useFetchMedicalRecord";
import { useCreateMedicalRecord } from "@/src/api/useCreateMedicalRecord";
import { useUpdateMedicalRecord } from "@/src/api/useUpdateMedicalRecord";

const createEmptyForm = (): FormValues => ({
  name: "",
  nationalId: "",
  sex: "",
  age: "",
  birthDate: "",
  birthPlace: "",
  consultationReason: "",
  earlyDevelopment: "",
  schoolAndWork: "",
  lifestyleHabits: "",
  traumaticEvents: "",
  emotionalConsiderations: "",
  physicalConsiderations: "",
  mentalHistory: "",
  objective: "",
  familyMembers: [],
  evolutionNotes: [],
});

function MedicalRecordsPageContent() {
  const { patients, loading, error, fetchPatients } = useFetchPatients();
  const [ selectedPatientId, setSelectedPatientId ] = useQueryState("patientId", parseAsString.withDefault(""));
  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const { medicalRecord, fetchMedicalRecord, loading: loadingMedicalRecord } = useFetchMedicalRecord(selectedPatient?.medicalRecord?.id);
  const { createMedicalRecord } = useCreateMedicalRecord();
  const { updateMedicalRecord, loading: saving } = useUpdateMedicalRecord();

  const [ form, setForm ] = useState<FormValues>(createEmptyForm());

  useEffect(() => {
    if (selectedPatient?.medicalRecord?.id) {
      fetchMedicalRecord();
    }
  }, [ fetchMedicalRecord, selectedPatient?.medicalRecord?.id ]);

  useEffect(() => {
    if (medicalRecord) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: medicalRecord.name || "",
        nationalId: medicalRecord.nationalId || "",
        sex: medicalRecord.sex || "",
        age: medicalRecord.age || "",
        birthDate: medicalRecord.birthDate || "",
        birthPlace: medicalRecord.birthPlace || "",
        consultationReason: medicalRecord.consultationReason || "",
        earlyDevelopment: medicalRecord.earlyDevelopment || "",
        schoolAndWork: medicalRecord.schoolAndWork || "",
        lifestyleHabits: medicalRecord.lifestyleHabits || "",
        traumaticEvents: medicalRecord.traumaticEvents || "",
        emotionalConsiderations: medicalRecord.emotionalConsiderations || "",
        physicalConsiderations: medicalRecord.physicalConsiderations || "",
        mentalHistory: medicalRecord.mentalHistory || "",
        objective: medicalRecord.objective || "",
        familyMembers: medicalRecord.familyMembers?.length
          ? medicalRecord.familyMembers
          : [],
        evolutionNotes: medicalRecord.evolutionNotes?.length
          ? medicalRecord.evolutionNotes
          : [],
      });
    } else {
      setForm(createEmptyForm());
    }
  }, [ medicalRecord ]);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [ key ]: value }));
  };

  const handleSave = async () => {
    if (!selectedPatientId || !medicalRecord) return;

    try {
      await updateMedicalRecord(medicalRecord.id, form);
    } catch (err) {
      console.error("Error saving medical record:", err);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Historias clínicas"
        subtitle={todayString()}
      />
      {error && <ErrorBanner msg={error} onRetry={fetchPatients} />}
      <div style={{ display: "grid", gap: 24 }}>
        <MedicalRecordCard title="Seleccionar Paciente" icon="👤">
          <label className="form-label">
            <RequiredField label="Paciente" />
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
                <LoadingSpinner />
                <span>Cargando pacientes...</span>
              </div>
            ) : (
              <CustomSelect
                value={selectedPatientId || ""}
                placeholder="Seleccionar paciente…"
                options={patients.length > 0
                  ? patients.map((p) => ({ value: p.id, label: getPatientFullName(p) }))
                  : [ { value: "", label: "No hay pacientes registrados" } ]
                }
                // Fix 1 (cont.): just update the ID here; the useEffect above handles fetching.
                onChange={(value) => setSelectedPatientId(value)}
              />
            )}
          </label>
        </MedicalRecordCard>

        {loadingMedicalRecord && (
          <div style={{ textAlign: "center", padding: 24 }}>
            <LoadingSpinner />
            <p style={{ marginTop: 12 }}>Cargando historia clínica...</p>
          </div>
        )}

        {selectedPatientId && !medicalRecord && !loadingMedicalRecord && (
          <div style={{ textAlign: "center", padding: 24 }}>
            <MedicalRecordCard title="" icon="">
              <p className="modal-confrim-text">El paciente no tiene una historia clínica registrada.</p>
              <button type="button" className="btn-primary" onClick={async () => {
                await createMedicalRecord({ patientId: selectedPatientId, name: getPatientFullName(selectedPatient) });
                await fetchPatients();
              }}>
                Crear historia clínica
              </button>
            </MedicalRecordCard>
          </div>
        )}

        {selectedPatientId && medicalRecord && !loadingMedicalRecord && (
          <>
            <MedicalRecordCard title="Datos Generales" icon="📋">
              <GeneralDataSection form={form} onChange={updateForm} />
            </MedicalRecordCard>
            <MedicalRecordCard title="Composición Familiar" icon="👨‍👩‍👧‍👦">
              <FamilyTable
                familyMembers={form.familyMembers || []}
                onChange={(familyMembers) => setForm((current) => ({ ...current, familyMembers }))}
              />
            </MedicalRecordCard>
            <MedicalRecordCard title="Antecedentes" icon="📚">
              <AntecedentsSection form={form} onChange={updateForm} />
            </MedicalRecordCard>
            <MedicalRecordCard title="Notas de Evolución" icon="📝">
              <EvolutionNotes
                evolutionNotes={form.evolutionNotes || []}
                onChange={(evolutionNotes) => setForm((current) => ({ ...current, evolutionNotes }))}
              />
            </MedicalRecordCard>
            <div style={{
              position: "sticky",
              bottom: 0,
              background: "var(--c-surface)",
              borderRadius: "var(--r-3xl) var(--r-3xl) 0 0",
              boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.10)",
              borderTop: "1px solid var(--c-border, rgba(0,0,0,0.06))",
              padding: 15,
              margin: "0 -24px -24px",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10
            }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                Guardar historia clínica
              </button>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}

export default function MedicalRecordsPage() {
  return (
    <Suspense>
      <MedicalRecordsPageContent />
    </Suspense>
  );
}