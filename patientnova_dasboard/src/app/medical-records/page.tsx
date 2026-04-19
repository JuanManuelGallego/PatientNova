"use client";
import { Suspense, useState, useEffect, useRef } from "react";

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

const AUTO_SAVE_DEBOUNCE_MS = 1500;

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
  const { updateMedicalRecord } = useUpdateMedicalRecord();

  const [ form, setForm ] = useState<FormValues>(createEmptyForm());
  const isReady = useRef(false);
  const [ saveStatus, setSaveStatus ] = useState<"idle" | "saved" | "error">("idle");

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
        familyMembers: medicalRecord.familyMembers?.length ? medicalRecord.familyMembers : [],
        evolutionNotes: medicalRecord.evolutionNotes?.length ? medicalRecord.evolutionNotes : [],
      });
      isReady.current = true;
    } else {
      setForm(createEmptyForm());
      isReady.current = false;
    }
  }, [ medicalRecord ]);

  useEffect(() => {
    if (!isReady.current || !selectedPatientId || !medicalRecord) return;

    const timeout = setTimeout(async () => {
      try {
        await updateMedicalRecord(medicalRecord.id, form);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), AUTO_SAVE_DEBOUNCE_MS);
      } catch (err) {
        console.error("Error auto-saving medical record:", err);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), AUTO_SAVE_DEBOUNCE_MS);
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      setSaveStatus("idle");
    };
  }, [ form ]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [ key ]: value }));
  };

  return (
    <PageLayout>
      <PageHeader title="Historias clínicas" subtitle={todayString()} />
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
                options={
                  patients.length > 0
                    ? patients.map((p) => ({ value: p.id, label: getPatientFullName(p) }))
                    : [ { value: "", label: "No hay pacientes registrados" } ]
                }
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
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  await createMedicalRecord({ patientId: selectedPatientId, name: getPatientFullName(selectedPatient) });
                  await fetchPatients();
                }}
              >
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
          </>
        )}
      </div>
      <div style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 999,
        background: "var(--c-surface)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
        border: "1px solid var(--c-border, rgba(0,0,0,0.08))",
        fontSize: 13,
        color: saveStatus === "error" ? "var(--c-danger, #e53e3e)" : "var(--c-text-muted)",
        opacity: saveStatus === "idle" ? 0 : 1,
        pointerEvents: "none",
        transition: "opacity 0.3s ease",
      }}>
        {saveStatus === "saved" && <>✅ Guardado</>}
        {saveStatus === "error" && <>❌ Error al guardar</>}
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