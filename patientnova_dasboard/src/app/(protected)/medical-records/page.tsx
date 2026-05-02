"use client";
import { Suspense, useState, useEffect, useCallback } from "react";

import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Required";
import { getPatientFullName } from "@/src/utils/AvatarHelper";
import { createEmptyForm, FormValues } from "@/src/types/MedicalRecord";
import { GeneralDataSection } from "@/src/components/MedicalRecord/GeneralDataSection";
import { FamilyTable } from "@/src/components/FamilyTable";
import { AntecedentsSection } from "@/src/components/MedicalRecord/AntecedentsSection";
import { EvolutionNotes } from "@/src/components/EvolutionNotes";
import { todayString } from "@/src/utils/TimeUtils";
import { parseAsString, useQueryState } from "nuqs";
import { LoadingSpinner } from "@/src/components/LoadingSpinner";
import { MedicalRecordCard } from "@/src/components/MedicalRecord/MedicalRecordCard";
import { useCreateMedicalRecord } from "@/src/api/useCreateMedicalRecord";
import { useUpdateMedicalRecord } from "@/src/api/useUpdateMedicalRecord";
import { LBL_SAVED, LBL_SAVE_ERROR, LBL_LOADING } from "@/src/constants/ui";
import { downloadMedicalRecordPDF } from "@/src/components/MedicalRecord/MedicalRecordPDF";
import { useAuthContext } from "../../AuthContext";
import { DocumentsSection } from "@/src/components/MedicalRecord/DocumentsSection";
import { useFetchMedicalRecords } from "@/src/api/useFetchMedicalRecords";
import { useAutoSaveMedicalRecords } from "@/src/hooks/useAutoSaveMedicalRecords";

function MedicalRecordsPageContent() {
  const { user } = useAuthContext();
  const { patients, loading: loadingPatients, error, fetchPatients } = useFetchPatients();
  const [ selectedPatientId, setSelectedPatientId ] = useQueryState("patientId", parseAsString.withDefault(""));
  const [ form, setForm ] = useState<FormValues>(createEmptyForm());

  const { createMedicalRecord } = useCreateMedicalRecord();
  const { updateMedicalRecord } = useUpdateMedicalRecord();

  const { medicalRecords, loading: loadingMedicalRecord } = useFetchMedicalRecords(selectedPatientId ? { patientId: selectedPatientId } : {});
  const medicalRecord = medicalRecords?.[ 0 ];

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
        familyObservations: medicalRecord.familyObservations || "",
        familyMembers: medicalRecord.familyMembers?.length ? medicalRecord.familyMembers : [],
        evolutionNotes: medicalRecord.evolutionNotes?.length ? medicalRecord.evolutionNotes : [],
        documents: medicalRecord.documents || [],
      });
    } else {
      setForm(createEmptyForm());
    }
  }, [ medicalRecord ]);

  
  const updateField = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[ K ]) => {
    setForm((current) => ({ ...current, [ key ]: value }));
  }, []);

  const handleCreateRecord = useCallback(async () => {
    const patient = patients.find((p) => p.id === selectedPatientId);
    await createMedicalRecord({
      patientId: selectedPatientId,
      name: getPatientFullName(patient),
    });
    await fetchPatients();
  }, [ createMedicalRecord, fetchPatients, patients, selectedPatientId ]);
  
  const showRecord = selectedPatientId && medicalRecord && !loadingMedicalRecord;
  const showEmpty = selectedPatientId && !medicalRecord && !loadingMedicalRecord;
  const saveStatus = useAutoSaveMedicalRecords(form, medicalRecord?.id, updateMedicalRecord);

  return (
    <PageLayout>
      <PageHeader
        title="Historias clínicas"
        subtitle={todayString()}
        actions={
          medicalRecord && (
            <button type="button" className="btn-primary" onClick={() => downloadMedicalRecordPDF(user, form)}>
              Descargar PDF
            </button>
          )
        }
      />
      {error && <ErrorBanner msg={error} onRetry={fetchPatients} />}
      <div style={{ display: "grid", gap: 24 }}>
        <MedicalRecordCard title="Seleccionar Paciente" icon="👤">
          <label className="form-label">
            <RequiredField label="Paciente" />
            {loadingPatients ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
                <LoadingSpinner />
                <span>{LBL_LOADING}</span>
              </div>
            ) : (
              <CustomSelect
                value={selectedPatientId}
                placeholder="Seleccionar paciente…"
                options={
                  patients.length > 0
                    ? patients.map((p) => ({ value: p.id, label: getPatientFullName(p) }))
                    : [ { value: "", label: "No hay pacientes registrados" } ]
                }
                onChange={setSelectedPatientId}
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
        {showEmpty && (
          <div style={{ textAlign: "center", padding: 24 }}>
            <MedicalRecordCard title="" icon="">
              <p className="dash-empty__text" style={{ paddingBottom: 10 }}>El paciente no tiene una historia clínica registrada.</p>
              <button type="button" className="btn-primary" onClick={handleCreateRecord}>
                Crear historia clínica
              </button>
            </MedicalRecordCard>
          </div>
        )}
        {showRecord && (
          <>
            <MedicalRecordCard title="Datos Generales" icon="📋">
              <GeneralDataSection form={form} onChange={updateField} />
            </MedicalRecordCard>
            <MedicalRecordCard title="Composición Familiar" icon="👨‍👩‍👧‍👦">
              <FamilyTable
                familyMembers={form.familyMembers ?? []}
                onChange={(familyMembers) => updateField("familyMembers", familyMembers)}
              />
              <label className="form-label" style={{ gridColumn: "1 / -1", paddingTop: 16 }}>
                Observaciones
                <textarea
                  className="form-input form-input--textarea"
                  value={form.familyObservations}
                  onChange={(e) => updateField("familyObservations", e.target.value)}
                  placeholder="Observaciones generales sobre la composición familiar"
                />
              </label>
            </MedicalRecordCard>
            <MedicalRecordCard title="Antecedentes" icon="📚">
              <AntecedentsSection form={form} onChange={updateField} />
            </MedicalRecordCard>
            <MedicalRecordCard title="Notas de Evolución" icon="📝">
              <EvolutionNotes
                evolutionNotes={form.evolutionNotes ?? []}
                onChange={(evolutionNotes) => updateField("evolutionNotes", evolutionNotes)}
              />
            </MedicalRecordCard>
            <MedicalRecordCard title="Documentos relacionados" icon="📂">
              <DocumentsSection
                documents={form.documents ?? []}
                onChange={(documents) => updateField("documents", documents)}
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
        {saveStatus === "saved" && <>{LBL_SAVED}</>}
        {saveStatus === "error" && <>{LBL_SAVE_ERROR}</>}
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