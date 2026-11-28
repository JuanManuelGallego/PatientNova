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
import { createEmptyForm, FormValues, RecordPatch } from "@/src/types/MedicalRecord";
import { PreviousFields } from "@/src/components/MedicalRecord/PreviousFields";
import { RecordSnapshots } from "@/src/components/MedicalRecord/RecordSnapshots";
import { RecordCardBody } from "@/src/components/MedicalRecord/RecordCardBody";
import { MissingRequiredHint } from "@/src/components/MedicalRecord/MissingRequiredHint";
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
import { renderMedicalRecordPdf } from "@/src/components/MedicalRecord/MedicalRecordPDF";
import { useSaveFile } from "@/src/hooks/useSaveFile";
import { useAuthContext } from "@/src/providers/AuthContext";
import { DocumentsSection } from "@/src/components/MedicalRecord/DocumentsSection";
import { useFetchMedicalRecords } from "@/src/api/medical-records/useFetchMedicalRecords";
import { useRecordAutosave } from "@/src/hooks/useRecordAutosave";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { missingRequired, previousFields, recordLayout } from "@/src/utils/recordLayout";

const MEDICAL_RECORD_AUTOSAVE_MS = 1500;

type RecordSection = number | "evolution" | "documents";

function MedicalRecordsPageContent() {
  const timezone = useDisplayTimezone();
  const { user } = useAuthContext();
  const { save, retryDialog } = useSaveFile();
  const { loading: loadingPatients, error, fetchPatients } = useFetchPatients();
  const [ selectedPatientId, setSelectedPatientId ] = useQueryState(QUERY_PARAMS.recordPatientId, parseAsString.withDefault(""));
  const [ form, setForm ] = useState<FormValues>(createEmptyForm());
  const formRef = useRef(form);

  const { createMedicalRecord } = useCreateMedicalRecord();
  const { updateMedicalRecord } = useUpdateMedicalRecord();
  const [ activeSection, setActiveSection ] = useState<RecordSection | null>(null);

  const { patient: selectedPatient } = useFetchPatient(selectedPatientId || null);

  const { medicalRecords, loading: loadingMedicalRecord, fetchMedicalRecords } = useFetchMedicalRecords(selectedPatientId ? { patientId: selectedPatientId } : null);
  const medicalRecord = selectedPatientId ? medicalRecords?.[ 0 ] : undefined;
  const recordId = medicalRecord?.id;
  // A refused save means the type or its template changed elsewhere: reload the record to show the current form.
  const autosave = useRecordAutosave(recordId, {
    save: updateMedicalRecord,
    onRejected: () => { void fetchMedicalRecords(); },
    delay: MEDICAL_RECORD_AUTOSAVE_MS,
  });
  const { change: saveChange, reset: resetAutosave } = autosave;

  useEffect(() => {
    const loaded: FormValues = medicalRecord ? {
      name: medicalRecord.name || "",
      nationalId: medicalRecord.nationalId || "",
      sex: medicalRecord.sex || "",
      birthDate: medicalRecord.birthDate || "",
      birthPlace: medicalRecord.birthPlace || "",
      data: medicalRecord.data ?? {},
      familyMembers: medicalRecord.familyMembers?.length ? medicalRecord.familyMembers : [],
      evolutionNotes: medicalRecord.evolutionNotes?.length ? medicalRecord.evolutionNotes : [],
      documents: medicalRecord.documents || [],
      subsystemRelations: medicalRecord.subsystemRelations?.length ? medicalRecord.subsystemRelations : [],
    } : createEmptyForm();
    formRef.current = loaded;
    resetAutosave(medicalRecord?.id ?? "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(loaded);
    setActiveSection(null);
  }, [ medicalRecord, resetAutosave ]);

  const recordType = medicalRecord?.patientType;
  const applyChange = useCallback((section: RecordSection, change: RecordPatch) => {
    const next: FormValues = { ...formRef.current, ...change, data: { ...formRef.current.data, ...change.data } };
    formRef.current = next;
    setForm(next);
    if (!recordId) return;
    setActiveSection(section);
    saveChange(change);
  }, [ recordId, saveChange ]);

  const cards = useMemo(() => recordType
    ? recordLayout(recordType.template, { familyMembers: recordType.familyMembersEnabled, subsystemRelations: recordType.subsystemRelationsEnabled })
    : [], [ recordType ]);
  const previous = useMemo(() => recordType ? previousFields(recordType.template, form.data) : [], [ recordType, form.data ]);
  const missing = useMemo(() => recordType ? missingRequired(recordType.template, form.data) : [], [ recordType, form.data ]);

  const saveIndicator = (section: RecordSection) => activeSection === section
    ? <SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} />
    : null;
  const saveError = (section: RecordSection) => activeSection === section && autosave.error ? (
    <div className="error-inline" role="alert" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
      <STATUS_ICONS.warning size={14} /> {autosave.error}
    </div>
  ) : null;

  const handleCreateRecord = useCallback(async () => {
    await createMedicalRecord({
      patientId: selectedPatientId,
      name: getPatientFullName(selectedPatient),
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
          showRecord && recordType && (
            <button type="button" className="btn-primary" onClick={async () => { const { blob, filename } = await renderMedicalRecordPdf(user, form, recordType); await save(blob, filename); }} data-testid="medical-records-download-pdf-button">
              Descargar PDF
            </button>
          )
        }
      />
      {error && <ErrorBanner msg={error} onRetry={fetchPatients} />}
      <div style={{ display: "grid", gap: 24 }}>
        <MedicalRecordCard title="Seleccionar paciente">
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
          {showRecord && recordType && (
            <p className="dash-empty__text" style={{ margin: "12px 0 0" }} data-testid="medical-records-patient-type">
              Tipo de paciente: <strong>{recordType.name}</strong>
            </p>
          )}
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
              <p className="dash-empty__text" style={{ paddingBottom: 4 }}>El paciente no tiene una historia clínica registrada.</p>
              {selectedPatient?.patientType && (
                <p className="dash-empty__text" style={{ paddingBottom: 10 }} data-testid="medical-records-patient-type">
                  Tipo de paciente: {selectedPatient.patientType.name}
                </p>
              )}
              <button type="button" className="btn-primary" onClick={handleCreateRecord} data-testid="medical-records-create-button">
                Crear historia clínica
              </button>
            </MedicalRecordCard>
          </div>
        )}
        {showRecord && recordType && (
          <>
            <MissingRequiredHint labels={missing} />
            {cards.map((card, i) => (
              <MedicalRecordCard key={`${i}-${card.title}`} title={card.title} actions={saveIndicator(i)}>
                <RecordCardBody
                  card={card}
                  form={form}
                  onIdentity={(key, value) => applyChange(i, { [ key ]: value })}
                  onData={(key, value) => applyChange(i, { data: { [ key ]: value } })}
                  onFamilyMembers={(familyMembers) => applyChange(i, { familyMembers })}
                  onSubsystemRelations={(subsystemRelations) => applyChange(i, { subsystemRelations })}
                />
                {saveError(i)}
              </MedicalRecordCard>
            ))}
            <PreviousFields items={previous} />
            <MedicalRecordCard title="Notas de evolución" actions={saveIndicator("evolution")}>
              <EvolutionNotes
                evolutionNotes={form.evolutionNotes ?? []}
                onChange={(evolutionNotes) => applyChange("evolution", { evolutionNotes })}
              />
              {saveError("evolution")}
            </MedicalRecordCard>
            <MedicalRecordCard title="Documentos relacionados" actions={saveIndicator("documents")}>
              <DocumentsSection
                documents={form.documents ?? []}
                onChange={(documents) => applyChange("documents", { documents })}
              />
              {saveError("documents")}
            </MedicalRecordCard>
            <RecordSnapshots snapshots={medicalRecord.snapshots ?? []} />
          </>
        )}
      </div>
      {retryDialog}
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
