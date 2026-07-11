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
import { LBL_LOADING } from "@/src/constants/ui";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { downloadMedicalRecordPDF } from "@/src/components/MedicalRecord/MedicalRecordPDF";
import { useAuthContext } from "../../AuthContext";
import { DocumentsSection } from "@/src/components/MedicalRecord/DocumentsSection";
import { useFetchMedicalRecords } from "@/src/api/useFetchMedicalRecords";
import { useAutoSaveMedicalRecords } from "@/src/hooks/useAutoSaveMedicalRecords";
import { FamilySpecificSection } from "@/src/components/MedicalRecord/FamilySpecificSection";

function MedicalRecordsPageContent() {
  const { user } = useAuthContext();
  const { patients, loading: loadingPatients, error, fetchPatients } = useFetchPatients();
  const [ selectedPatientId, setSelectedPatientId ] = useQueryState("patientId", parseAsString.withDefault(""));
  const [ form, setForm ] = useState<FormValues>(createEmptyForm());

  const { createMedicalRecord } = useCreateMedicalRecord();
  const { updateMedicalRecord } = useUpdateMedicalRecord();

  const { medicalRecords, loading: loadingMedicalRecord, fetchMedicalRecords } = useFetchMedicalRecords(selectedPatientId ? { patientId: selectedPatientId } : {});
  const medicalRecord = medicalRecords?.[ 0 ];

  useEffect(() => {
    if (medicalRecord) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: medicalRecord.name || "",
        nationalId: medicalRecord.nationalId || "",
        sex: medicalRecord.sex || "",
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
        isFamily: medicalRecord.isFamily ?? false,
        familyType: medicalRecord.familyType || "",
        lifecycle: medicalRecord.lifecycle || "",
        genogram: medicalRecord.genogram || "",
        resources: medicalRecord.resources || "",
        difficulties: medicalRecord.difficulties || "",
        communication: medicalRecord.communication || "",
        rule: medicalRecord.rule || "",
        limits: medicalRecord.limits || "",
        familyContext: medicalRecord.familyContext || "",
        expectations: medicalRecord.expectations || "",
        flexibility: medicalRecord.flexibility || "",
        familyMembers: medicalRecord.familyMembers?.length ? medicalRecord.familyMembers : [],
        evolutionNotes: medicalRecord.evolutionNotes?.length ? medicalRecord.evolutionNotes : [],
        documents: medicalRecord.documents || [],
        subsystemRelations: medicalRecord.subsystemRelations?.length ? medicalRecord.subsystemRelations : [],
      });
    } else {
      setForm(createEmptyForm());
    }
  }, [ medicalRecord ]);

  const updateField = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[ K ]) => {
    setForm((current) => ({ ...current, [ key ]: value }));
  }, []);

  const handleCreateRecord = useCallback(async (isFamily: boolean) => {
    const patient = patients.find((p) => p.id === selectedPatientId);
    await createMedicalRecord({
      patientId: selectedPatientId,
      name: getPatientFullName(patient),
      isFamily,
    });
    await fetchMedicalRecords();
  }, [ createMedicalRecord, fetchMedicalRecords, patients, selectedPatientId ]);

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
        <MedicalRecordCard title="Seleccionar Paciente">
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
              <button type="button" className="btn-primary" onClick={() => handleCreateRecord(false)} style={{ marginRight: 8 }}>
                Crear historia clínica individual
              </button>
              <button type="button" className="btn-primary" onClick={() => handleCreateRecord(true)}>
                Crear historia clínica de familia
              </button>
            </MedicalRecordCard>
          </div>
        )}
        {showRecord && (
          <>
            <MedicalRecordCard title="Datos Generales">
              <GeneralDataSection form={form} onChange={updateField} />
            </MedicalRecordCard>
            <MedicalRecordCard title="Composición Familiar">
              <FamilyTable
                familyMembers={form.familyMembers ?? []}
                onChange={(familyMembers) => updateField("familyMembers", familyMembers)}
              />
              {!form.isFamily && <label className="form-label" style={{ gridColumn: "1 / -1", paddingTop: 16 }}>
                Observaciones
                <textarea
                  className="form-input form-input--textarea"
                  value={form.familyObservations}
                  onChange={(e) => updateField("familyObservations", e.target.value)}
                  placeholder="Observaciones generales sobre la composición familiar"
                />
              </label>}
            </MedicalRecordCard>
            {form.isFamily ?
              <MedicalRecordCard title="Aspectos específicos de la familia">
                <FamilySpecificSection form={form} onChange={updateField} />
              </MedicalRecordCard>
              : <MedicalRecordCard title="Antecedentes">
                <AntecedentsSection form={form} onChange={updateField} />
              </MedicalRecordCard>
            }
            <MedicalRecordCard title="Notas de Evolución">
              <EvolutionNotes
                evolutionNotes={form.evolutionNotes ?? []}
                onChange={(evolutionNotes) => updateField("evolutionNotes", evolutionNotes)}
              />
            </MedicalRecordCard>
            <MedicalRecordCard title="Documentos relacionados">
              <DocumentsSection
                documents={form.documents ?? []}
                onChange={(documents) => updateField("documents", documents)}
              />
            </MedicalRecordCard>
          </>
        )}
      </div>
      <SaveStatusIndicator status={saveStatus} showText={false} />
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