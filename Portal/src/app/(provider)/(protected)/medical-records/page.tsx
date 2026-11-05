"use client";
import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";

import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { useFetchPatients } from "@/src/api/patients/useFetchPatients";
import { useFetchPatient } from "@/src/api/patients/useFetchPatient";
import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { PatientAutocomplete } from "@/src/components/PatientAutocomplete";
import { RequiredField } from "@/src/components/Info/Required";
import { getPatientFullName } from "@/src/utils/AvatarHelper";
import { createEmptyForm, FormValues } from "@/src/types/MedicalRecord";
import { GeneralDataSection } from "@/src/components/MedicalRecord/GeneralDataSection";
import { FamilyTable } from "@/src/components/FamilyTable";
import { AntecedentsSection } from "@/src/components/MedicalRecord/AntecedentsSection";
import { EvolutionNotes } from "@/src/components/EvolutionNotes";
import { todayString } from "@/src/utils/TimeUtils";
import { parseAsString, useQueryState } from "nuqs";
import { QUERY_PARAMS } from "@/src/utils/listQuery";
import { LoadingSpinner } from "@/src/components/LoadingSpinner";
import { MedicalRecordCard } from "@/src/components/MedicalRecord/MedicalRecordCard";
import { useCreateMedicalRecord } from "@/src/api/medical-records/useCreateMedicalRecord";
import { useUpdateMedicalRecord } from "@/src/api/medical-records/useUpdateMedicalRecord";
import { LBL_LOADING } from "@/src/constants/ui";
import { STATUS_ICONS } from "@/src/config/icons";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { downloadMedicalRecordPDF } from "@/src/components/MedicalRecord/MedicalRecordPDF";
import { useAuthContext } from "@/src/providers/AuthContext";
import { DocumentsSection } from "@/src/components/MedicalRecord/DocumentsSection";
import { useFetchMedicalRecords } from "@/src/api/medical-records/useFetchMedicalRecords";
import { useDebouncedSave } from "@/src/hooks/useDebouncedSave";
import { FamilySpecificSection } from "@/src/components/MedicalRecord/FamilySpecificSection";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";

const MEDICAL_RECORD_AUTOSAVE_MS = 1500;

type RecordSection = "general" | "family" | "details" | "evolution" | "documents";

function MedicalRecordsPageContent() {
  const timezone = useDisplayTimezone();
  const { user } = useAuthContext();
  const { loading: loadingPatients, error, fetchPatients } = useFetchPatients();
  const [ selectedPatientId, setSelectedPatientId ] = useQueryState(QUERY_PARAMS.recordPatientId, parseAsString.withDefault(""));
  const [ form, setForm ] = useState<FormValues>(createEmptyForm());
  const formRef = useRef(form);

  const { createMedicalRecord } = useCreateMedicalRecord();
  const { updateMedicalRecord } = useUpdateMedicalRecord();
  const autosave = useDebouncedSave<{ id: string; form: FormValues }>(
    ({ id, form: values }) => updateMedicalRecord(id, values),
    { delay: MEDICAL_RECORD_AUTOSAVE_MS, dedupe: false },
  );
  const { schedule: scheduleSave } = autosave;
  const [ activeSection, setActiveSection ] = useState<RecordSection | null>(null);

  const { patient: selectedPatient } = useFetchPatient(selectedPatientId || null);

  const { medicalRecords, loading: loadingMedicalRecord, fetchMedicalRecords } = useFetchMedicalRecords(selectedPatientId ? { patientId: selectedPatientId } : null);
  const medicalRecord = selectedPatientId ? medicalRecords?.[ 0 ] : undefined;

  useEffect(() => {
    const loaded: FormValues = medicalRecord ? {
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
    } : createEmptyForm();
    formRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(loaded);
    setActiveSection(null);
  }, [ medicalRecord ]);

  const recordId = medicalRecord?.id;
  const updateField = useCallback(<K extends keyof FormValues>(section: RecordSection, key: K, value: FormValues[ K ]) => {
    const next = { ...formRef.current, [ key ]: value };
    formRef.current = next;
    setForm(next);
    if (!recordId) return;
    setActiveSection(section);
    scheduleSave({ id: recordId, form: next });
  }, [ recordId, scheduleSave ]);
  const fieldsIn = useMemo(() => {
    const inSection = (section: RecordSection) =>
      <K extends keyof FormValues>(key: K, value: FormValues[ K ]) => updateField(section, key, value);
    return {
      general: inSection("general"),
      family: inSection("family"),
      details: inSection("details"),
      evolution: inSection("evolution"),
      documents: inSection("documents"),
    };
  }, [ updateField ]);

  const saveIndicator = (section: RecordSection) => activeSection === section
    ? <SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} />
    : null;
  const saveError = (section: RecordSection) => activeSection === section && autosave.error ? (
    <div className="error-inline" role="alert" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
      <STATUS_ICONS.warning size={14} /> {autosave.error}
    </div>
  ) : null;

  const handleCreateRecord = useCallback(async (isFamily: boolean) => {
    await createMedicalRecord({
      patientId: selectedPatientId,
      name: getPatientFullName(selectedPatient),
      isFamily,
    });
    await fetchMedicalRecords();
  }, [ createMedicalRecord, fetchMedicalRecords, selectedPatient, selectedPatientId ]);

  const showRecord = selectedPatientId && medicalRecord && !loadingMedicalRecord;
  const showEmpty = selectedPatientId && !medicalRecord && !loadingMedicalRecord;

  return (
    <PageLayout>
      <PageHeader
        title="Historias clínicas"
        subtitle={todayString(timezone)}
        actions={
          showRecord && (
            <button type="button" className="btn-primary" onClick={() => downloadMedicalRecordPDF(user, form)} data-testid="medical-records-download-pdf-button">
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
              <PatientAutocomplete
                value={selectedPatientId}
                placeholder="Seleccionar paciente…"
                onChange={(v) => {
                  setSelectedPatientId(v);
                }}
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
              <button type="button" className="btn-primary" onClick={() => handleCreateRecord(false)} style={{ marginRight: 8 }} data-testid="medical-records-create-individual-button">
                Crear historia clínica individual
              </button>
              <button type="button" className="btn-primary" onClick={() => handleCreateRecord(true)} data-testid="medical-records-create-family-button">
                Crear historia clínica de familia
              </button>
            </MedicalRecordCard>
          </div>
        )}
        {showRecord && (
          <>
            <MedicalRecordCard title="Datos Generales" actions={saveIndicator("general")}>
              <GeneralDataSection form={form} onChange={fieldsIn.general} />
              {saveError("general")}
            </MedicalRecordCard>
            <MedicalRecordCard title="Composición Familiar" actions={saveIndicator("family")}>
              <FamilyTable
                familyMembers={form.familyMembers ?? []}
                onChange={(familyMembers) => fieldsIn.family("familyMembers", familyMembers)}
              />
              {!form.isFamily && <label className="form-label" style={{ gridColumn: "1 / -1", paddingTop: 16 }}>
                Observaciones
                <textarea
                  className="form-input form-input--textarea"
                  value={form.familyObservations}
                  onChange={(e) => fieldsIn.family("familyObservations", e.target.value)}
                  placeholder="Observaciones generales sobre la composición familiar"
                />
              </label>}
              {saveError("family")}
            </MedicalRecordCard>
            {form.isFamily ?
              <MedicalRecordCard title="Aspectos específicos de la familia" actions={saveIndicator("details")}>
                <FamilySpecificSection form={form} onChange={fieldsIn.details} />
                {saveError("details")}
              </MedicalRecordCard>
              : <MedicalRecordCard title="Antecedentes" actions={saveIndicator("details")}>
                <AntecedentsSection form={form} onChange={fieldsIn.details} />
                {saveError("details")}
              </MedicalRecordCard>
            }
            <MedicalRecordCard title="Notas de Evolución" actions={saveIndicator("evolution")}>
              <EvolutionNotes
                evolutionNotes={form.evolutionNotes ?? []}
                onChange={(evolutionNotes) => fieldsIn.evolution("evolutionNotes", evolutionNotes)}
              />
              {saveError("evolution")}
            </MedicalRecordCard>
            <MedicalRecordCard title="Documentos relacionados" actions={saveIndicator("documents")}>
              <DocumentsSection
                documents={form.documents ?? []}
                onChange={(documents) => fieldsIn.documents("documents", documents)}
              />
              {saveError("documents")}
            </MedicalRecordCard>
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