"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Users } from "lucide-react";
import { useFetchPatientTypes } from "@/src/api/patient-types/useFetchPatientTypes";
import {
  consentFileProblem,
  downloadConsentVersion,
  useDeletePatientType,
  useSetDefaultPatientType,
  useUploadConsentVersion,
} from "@/src/api/patient-types/usePatientTypeMutations";
import { useApiQuery } from "@/src/api/base/useApiQuery";
import { API_BASE } from "@/src/config/api";
import { ACTION_ICONS } from "@/src/config/icons";
import { InlineError } from "@/src/components/Info/InlineError";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { PatientTypeNameModal } from "@/src/components/Modals/PatientTypeNameModal";
import { useSavedFlash } from "@/src/hooks/useSavedFlash";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { useAuthContext } from "@/src/providers/AuthContext";
import { isAdminRole } from "@/src/types/User";
import { ConsentVersion, PatientType } from "@/src/types/PatientType";
import { fmtDate } from "@/src/utils/TimeUtils";
import { downloadBlob } from "@/src/utils/saveFile";
import { OnlineBadge } from "@/src/components/OnlineBadge";
import { SettingsList } from "./SettingsList";

const fmtSize = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

function VersionList({ patientType, timezone }: { patientType: PatientType; timezone: string }) {
  const { data, loading, error } = useApiQuery<ConsentVersion[]>(
    `${API_BASE}/patient-types/${patientType.id}/consent-versions`,
    "No pudimos cargar las versiones.",
  );
  const [ downloadError, setDownloadError ] = useState<string | null>(null);

  async function download(version: ConsentVersion) {
    setDownloadError(null);
    try {
      downloadBlob(await downloadConsentVersion(patientType.id, version.id), version.name);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "No pudimos descargar el archivo.");
    }
  }

  if (loading && !data) return <p className="form-input-hint">Cargando versiones…</p>;
  if (error) return <InlineError message={error} />;
  return (
    <div className="form-stack" style={{ gap: 6 }} data-testid={`patient-type-versions-${patientType.id}`}>
      {(data ?? []).map((v) => (
        <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--c-gray-600)" }}>
          <span style={{ fontWeight: 600 }}>v{v.version}</span>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
            {v.name} · {fmtSize(v.sizeBytes)} · {fmtDate(v.createdAt, timezone)}
          </span>
          <button type="button" className="btn-secondary" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => download(v)}>
            Descargar
          </button>
        </div>
      ))}
      {downloadError && <InlineError message={downloadError} />}
    </div>
  );
}

function PatientTypeCard({
  patientType,
  canEdit,
  timezone,
  onRename,
  onDelete,
  onMakeDefault,
  onChanged,
}: {
  patientType: PatientType;
  canEdit: boolean;
  timezone: string;
  onRename: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadConsentVersion, loading: uploading } = useUploadConsentVersion();
  const [ uploadError, setUploadError ] = useState<string | null>(null);
  const [ showVersions, setShowVersions ] = useState(false);
  const current = patientType.currentVersion;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[ 0 ];
    e.target.value = "";
    if (!file) return;
    const problem = consentFileProblem(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setUploadError(null);
    try {
      await uploadConsentVersion(patientType.id, file);
      onChanged();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No pudimos subir el formulario de consentimiento.");
    }
  }

  const patients = patientType.patientCount === 1 ? "1 paciente" : `${patientType.patientCount} pacientes`;

  return (
    <div className="location-card" style={{ padding: 0, overflow: "hidden" }} data-testid={`patient-type-card-${patientType.id}`}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="card-icon-tile" aria-hidden="true"><Users size={17} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 14 }}>
            {patientType.name}
            {patientType.isDefault && (
              <OnlineBadge testId={`patient-type-default-badge-${patientType.id}`} label="Predeterminado" />
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--c-gray-500)", marginTop: 2 }}>{patients}</div>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {!patientType.isDefault && (
              <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={onMakeDefault} data-testid={`patient-type-default-button-${patientType.id}`}>
                Hacer predeterminado
              </button>
            )}
            <button type="button" className="btn-action-edit" onClick={onRename} data-testid={`patient-type-rename-button-${patientType.id}`}>
              <ACTION_ICONS.edit size={14} /> Renombrar
            </button>
            {!patientType.isDefault && (
              <button
                type="button"
                className="btn-action-delete"
                onClick={onDelete}
                aria-label={`Eliminar tipo de paciente ${patientType.name}`}
                data-testid={`patient-type-delete-button-${patientType.id}`}
              >
                <ACTION_ICONS.delete size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--c-gray-200)", background: "var(--c-gray-50)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <FileText size={18} aria-hidden="true" style={{ flexShrink: 0, color: "var(--c-gray-500)" }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }} data-testid={`patient-type-consent-${patientType.id}`}>
            {current ? (
              <>
                <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{current.name}</div>
                <div style={{ fontSize: 12, color: "var(--c-gray-500)" }}>
                  Versión {current.version} · {fmtSize(current.sizeBytes)} · {fmtDate(current.createdAt, timezone)}
                </div>
              </>
            ) : (
              <span style={{ color: "var(--c-gray-500)" }}>
                Sin formulario de consentimiento: el mensaje de bienvenida no se puede enviar a estos pacientes.
              </span>
            )}
          </div>
          {current && (
            <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowVersions((v) => !v)} aria-expanded={showVersions}>
              {showVersions ? "Ocultar versiones" : "Versiones"}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: 12 }}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              data-testid={`patient-type-upload-button-${patientType.id}`}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Upload size={14} aria-hidden="true" /> {uploading ? "Subiendo…" : current ? "Subir nueva versión" : "Subir PDF"}
              </span>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: "none" }}
          onChange={handleFile}
          data-testid={`patient-type-file-input-${patientType.id}`}
        />
        {uploadError && <div style={{ marginTop: 8 }}><InlineError message={uploadError} /></div>}
        {showVersions && current && <div style={{ marginTop: 10 }}><VersionList patientType={patientType} timezone={timezone} /></div>}
      </div>
    </div>
  );
}

/** Settings › Tipos de paciente: each type with its consent PDF versions. A VIEWER sees it read-only. */
export function PatientTypesTab({ onReady }: { onReady?: () => void } = {}) {
  const { user } = useAuthContext();
  const canEdit = isAdminRole(user?.role);
  const timezone = useDisplayTimezone();
  const { data, loading, error, refetch } = useFetchPatientTypes();
  const saved = useSavedFlash();
  const { setDefaultPatientType } = useSetDefaultPatientType();
  const { deletePatientType, loading: deleting } = useDeletePatientType();

  const [ nameTarget, setNameTarget ] = useState<PatientType | null | undefined>(undefined);
  const [ deleteTarget, setDeleteTarget ] = useState<PatientType | null>(null);
  const [ deleteError, setDeleteError ] = useState<string | null>(null);
  const [ listError, setListError ] = useState<string | null>(null);

  function changed() {
    saved.flash();
    refetch();
  }

  async function makeDefault(type: PatientType) {
    setListError(null);
    try {
      await setDefaultPatientType(type.id);
      changed();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "No pudimos cambiar el tipo predeterminado.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deletePatientType(deleteTarget.id);
      setDeleteTarget(null);
      changed();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "No pudimos eliminar el tipo de paciente.");
    }
  }

  return (
    <div className="settings-stack">
      <SettingsList<PatientType>
        id="patient-types"
        title="Tipos de paciente"
        description="Cada tipo tiene su propio formulario de consentimiento (PDF, máx. 10 MB). El mensaje de bienvenida envía el del tipo del paciente."
        newLabel={canEdit ? "Nuevo tipo" : undefined}
        newTestId="settings-new-patient-type-button"
        onNew={canEdit ? () => setNameTarget(null) : undefined}
        items={data ?? undefined}
        loading={loading}
        error={error}
        onRetry={() => refetch()}
        empty={{ icon: Users, title: "Sin tipos de paciente", sub: "Crea un tipo para asignarlo a tus pacientes." }}
        onReady={onReady}
        status={<SaveStatusIndicator saving={false} status={saved.active ? "saved" : "idle"} testId="patient-types-save-state" />}
        renderItem={(t) => (
          <PatientTypeCard
            key={t.id}
            patientType={t}
            canEdit={canEdit}
            timezone={timezone}
            onRename={() => setNameTarget(t)}
            onDelete={() => { setDeleteError(null); setDeleteTarget(t); }}
            onMakeDefault={() => makeDefault(t)}
            onChanged={changed}
          />
        )}
      />
      {listError && <InlineError message={listError} />}
      {nameTarget !== undefined && (
        <PatientTypeNameModal patientType={nameTarget} onClose={() => setNameTarget(undefined)} onSaved={changed} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          icon={ACTION_ICONS.delete}
          title="Eliminar tipo de paciente"
          confirmLabel="Sí, eliminar"
          loadingLabel="Eliminando…"
          loading={deleting}
          error={deleteError}
          testId="delete-patient-type-dialog"
          onClose={() => { if (!deleting) setDeleteTarget(null); }}
          onConfirm={confirmDelete}
        >
          <p className="modal-confirm__text">
            ¿Deseas eliminar <strong>{deleteTarget.name}</strong>? Se eliminan también sus formularios de consentimiento.
            Solo se puede eliminar si ningún paciente lo usa.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
