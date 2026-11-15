import { useAutoSaveProfile } from "@/src/api/users/useUpdateProfile";
import { useConsentDocument } from "@/src/api/consent/useConsentDocument";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { InlineError } from "@/src/components/Info/InlineError";
import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { TextField } from "@/src/components/Form/TextField";
import { ImageField } from "@/src/components/Form/ImageField";
import { User } from "@/src/types/User";
import { getInitials } from "@/src/utils/AvatarHelper";
import { ACTION_ICONS } from "@/src/config/icons";
import { Upload, FileText, ClipboardList } from "lucide-react";
import { COMMON_TIMEZONES } from "@/src/utils/TimeUtils";
import { useState, useEffect, useRef } from "react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { CustomSelect } from "@/src/components/CustomSelect";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { SettingsSection } from "./SettingsSection";

// ─── Editable text fields ──────────────────────────────────────────────────

type EditableFields = {
  firstName: string;
  lastName: string;
  displayName: string;
  jobTitle: string;
  bankName: string;
  accountNumber: string;
  nationalId: string;
  bankingKey: string;
};

type ProfileSection = "photo" | "personal" | "logos" | "banking";

// ─── Avatar fallback ────────────────────────────────────────────────────────

function AvatarFallback({ initials }: { initials: string }) {
  return (
    <div
      style={{
        width: 100,
        height: 100,
        borderRadius: "50%",
        background: "var(--c-brand-accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 30,
        fontWeight: 700,
        color: "#fff",
        border: "3px solid var(--c-gray-200)",
      }}
    >
      {initials}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileTab() {
  const displayTimezone = useDisplayTimezone();
  const { user } = useAuthContext();

  const [ fields, setFields ] = useState<EditableFields>(() => ({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    displayName: user?.displayName ?? "",
    jobTitle: user?.jobTitle ?? "",
    bankName: user?.bankName ?? "",
    accountNumber: user?.accountNumber ?? "",
    nationalId: user?.nationalId ?? "",
    bankingKey: user?.bankingKey ?? "",
  }));
  const [ timezone, setTimezone ] = useState(user?.timezone ?? "America/Bogota");
  const [ avatar, setAvatar ] = useState<string | null>(user?.avatar ?? null);
  const [ logo, setLogo ] = useState<string | null>(user?.logo ?? null);
  const [ altLogo, setAltLogo ] = useState<string | null>(user?.altLogo ?? null);

  const autosave = useAutoSaveProfile();
  const [ activeSection, setActiveSection ] = useState<ProfileSection | null>(null);
  const [ imageError, setImageError ] = useState<{ section: ProfileSection; message: string } | null>(null);

  const {
    document,
    loading: docLoading,
    fetchDocument,
    uploadDocument,
    deleteDocument,
  } = useConsentDocument();
  const [ consentError, setConsentError ] = useState<string | null>(null);
  const [ confirmingDelete, setConfirmingDelete ] = useState(false);
  const [ deleting, setDeleting ] = useState(false);

  const consentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocument();
  }, [ fetchDocument ]);

  const initials = getInitials(
    user?.firstName?.[ 0 ] ?? "?",
    user?.lastName?.[ 0 ] ?? "?",
  );

  // ── Save ───────────────────────────────────────────────────────────────────

  function saveIndicator(section: ProfileSection) {
    if (activeSection !== section) return null;
    return <SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="profile-save-state" />;
  }

  function sectionError(section: ProfileSection) {
    const message = imageError?.section === section
      ? imageError.message
      : activeSection === section ? autosave.error : null;
    if (!message) return null;
    return <div style={{ marginTop: 12 }}><InlineError message={message} /></div>;
  }

  function scheduleSave(section: ProfileSection, overrides: Partial<User> = {}) {
    setImageError(null);
    setActiveSection(section);
    autosave.schedule({
      firstName: (overrides.firstName ?? fields.firstName).trim() || undefined,
      lastName: (overrides.lastName ?? fields.lastName).trim() || undefined,
      displayName: (overrides.displayName ?? fields.displayName).trim() || undefined,
      jobTitle: (overrides.jobTitle ?? fields.jobTitle).trim() || undefined,
      avatar: (overrides.avatar ?? avatar) || undefined,
      logo: (overrides.logo ?? logo) || undefined,
      altLogo: (overrides.altLogo ?? altLogo) || undefined,
      timezone: (overrides.timezone ?? timezone) || undefined,
      bankName: (overrides.bankName ?? fields.bankName).trim() || undefined,
      accountNumber: (overrides.accountNumber ?? fields.accountNumber).trim() || undefined,
      nationalId: (overrides.nationalId ?? fields.nationalId).trim() || undefined,
      bankingKey: (overrides.bankingKey ?? fields.bankingKey).trim() || undefined,
      ...overrides,
    });
  }

  function setField<K extends keyof EditableFields>(section: ProfileSection, key: K, value: string) {
    setFields((prev) => ({ ...prev, [ key ]: value }));
    scheduleSave(section, { [ key ]: value } as Partial<User>);
  }

  function imageErrorFor(section: ProfileSection) {
    return (message: string) => setImageError(message ? { section, message } : null);
  }

  // ── Consent document ───────────────────────────────────────────────────────

  async function handleConsentFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[ 0 ];
    if (!file) return;
    setConsentError(null);
    try {
      await uploadDocument(file);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al subir el documento";
      setConsentError(msg);
    }
    e.target.value = "";
  }

  async function handleConsentDelete() {
    setConsentError(null);
    setDeleting(true);
    try {
      await deleteDocument();
      setConfirmingDelete(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al eliminar el documento";
      setConsentError(msg);
    } finally {
      setDeleting(false);
    }
  }

  // ── Timezone (immediate save, kept as-is) ───────────────────────────────────

  function handleTimezoneChange(value: string) {
    setTimezone(value);
    scheduleSave("personal", { timezone: value });
    autosave.flush();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="settings-stack">
      <SettingsSection title="Foto de perfil" status={saveIndicator("photo")}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ImageField
            variant="circle"
            value={avatar}
            fallback={<AvatarFallback initials={initials} />}
            onChange={(value) => {
              setAvatar(value);
              scheduleSave("photo", { avatar: value ?? undefined });
            }}
            onError={imageErrorFor("photo")}
            maxSide={256}
            format="image/jpeg"
            selectLabel="Seleccionar imagen"
            removeLabel="Eliminar foto"
          />
        </div>
        {sectionError("photo")}
      </SettingsSection>

      <SettingsSection title="Información personal" status={saveIndicator("personal")}>
        <div className="form-stack">
          <div className="form-grid-2">
            <TextField
              testId="profile-first-name-input"
              label="Nombre"
              value={fields.firstName}
              onChange={(v) => setField("personal", "firstName", v)}
              placeholder="Juan"
            />
            <TextField
              testId="profile-last-name-input"
              label="Apellido"
              value={fields.lastName}
              onChange={(v) => setField("personal", "lastName", v)}
              placeholder="García"
            />
          </div>
          <TextField
            label="Nombre en pantalla"
            value={fields.displayName}
            onChange={(v) => setField("personal", "displayName", v)}
            placeholder="Dr. Juan García"
            hint="Aparece en la barra lateral y en la vista general."
          />
          <TextField
            label="Cargo"
            value={fields.jobTitle}
            onChange={(v) => setField("personal", "jobTitle", v)}
            placeholder="Médico general"
          />
          <label className="form-label">
            Correo electrónico
            <input
              className="form-input"
              type="email"
              value={user?.email ?? ""}
              disabled
              readOnly
              data-testid="profile-email"
            />
          </label>
          <label className="form-label">
            Zona horaria
            <CustomSelect
              value={timezone}
              onChange={handleTimezoneChange}
              options={COMMON_TIMEZONES.map((tz) => ({
                value: tz.value,
                label: tz.label,
              }))}
            />
            <span className="form-input-hint">
              Las horas que ves y las de tus avisos usan esta zona.
            </span>
          </label>
        </div>
        {sectionError("personal")}
      </SettingsSection>

      <SettingsSection title="Logos" description="PNG, SVG o WebP · Máx. 5 MB." status={saveIndicator("logos")}>
        <div className="form-grid-2">
          <ImageField
            label="Logo principal"
            hint="Úsalo sobre fondos claros. Recomendado: fondo transparente."
            value={logo}
            onChange={(value) => {
              setLogo(value);
              scheduleSave("logos", { logo: value ?? undefined });
            }}
            onError={imageErrorFor("logos")}
            maxSide={800}
            sizeErrorMessage="El logo debe ser menor a 5 MB"
            selectLabel="Subir"
            removeLabel="Eliminar"
          />
          <ImageField
            label="Logo alternativo (icono)"
            hint="Úsalo sobre fondos oscuros o de color."
            value={altLogo}
            onChange={(value) => {
              setAltLogo(value);
              scheduleSave("logos", { altLogo: value ?? undefined });
            }}
            onError={imageErrorFor("logos")}
            maxSide={800}
            sizeErrorMessage="El logo debe ser menor a 5 MB"
            selectLabel="Subir"
            removeLabel="Eliminar"
          />
        </div>
        {sectionError("logos")}
      </SettingsSection>

      <SettingsSection
        title="Información bancaria"
        description="Se envía a tus pacientes para que paguen sus consultas."
        status={saveIndicator("banking")}
      >
        <div className="form-grid-2">
          <TextField
            testId="profile-bank-name-input"
            label="Nombre del banco"
            value={fields.bankName}
            onChange={(v) => setField("banking", "bankName", v)}
            placeholder="Bancolombia"
          />
          <TextField
            label="Número de cuenta"
            value={fields.accountNumber}
            onChange={(v) => setField("banking", "accountNumber", v)}
            placeholder="123465789"
          />
          <TextField
            label="Cédula"
            value={fields.nationalId}
            onChange={(v) => setField("banking", "nationalId", v)}
            placeholder="123456789"
          />
          <TextField
            label="Llave"
            value={fields.bankingKey}
            onChange={(v) => setField("banking", "bankingKey", v)}
            placeholder="@llaveBancolombia"
          />
        </div>
        {sectionError("banking")}
      </SettingsSection>

      <SettingsSection
        title="Formulario de consentimiento"
        description="Un PDF que tus pacientes deben completar · Máx. 10 MB."
      >
        {document ? (
          <div
            style={{
              padding: 16,
              borderRadius: "var(--r-md)",
              border: "1px solid var(--c-gray-200)",
              background: "var(--c-gray-50)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, minWidth: 0 }}>
              <FileText size={24} aria-hidden="true" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--c-gray-900)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {document.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--c-gray-500)", marginTop: 4 }}>
                  {(document.sizeBytes / 1024).toFixed(2)} KB · Actualizado{" "}
                  {new Date(document.updatedAt).toLocaleDateString(undefined, { timeZone: displayTimezone })}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => consentRef.current?.click()}
                disabled={docLoading}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Upload size={14} aria-hidden="true" /> Reemplazar
                </span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, color: "var(--c-error)" }}
                onClick={() => { setConsentError(null); setConfirmingDelete(true); }}
                disabled={docLoading}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <ACTION_ICONS.delete size={14} aria-hidden="true" /> Eliminar
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: 32,
              borderRadius: "var(--r-md)",
              border: "2px dashed var(--c-gray-200)",
              background: "var(--c-gray-50)",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <ClipboardList size={32} aria-hidden="true" />
            </div>
            <p style={{ fontSize: 13, color: "var(--c-gray-500)", margin: "0 0 12px 0" }}>
              No hay ningún formulario de consentimiento cargado
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => consentRef.current?.click()}
              disabled={docLoading}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Upload size={14} aria-hidden="true" /> Subir PDF
              </span>
            </button>
          </div>
        )}
        <input
          ref={consentRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: "none" }}
          onChange={handleConsentFileChange}
        />
        {consentError && !confirmingDelete && (
          <div style={{ marginTop: 12 }}><InlineError message={consentError} /></div>
        )}
      </SettingsSection>

      {confirmingDelete && document && (
        <ConfirmDialog
          icon={ACTION_ICONS.delete}
          title="¿Eliminar el formulario de consentimiento?"
          confirmLabel="Eliminar"
          loadingLabel="Eliminando…"
          loading={docLoading || deleting}
          error={consentError}
          testId="consent-delete-dialog"
          onClose={() => {
            if (deleting) return;
            setConfirmingDelete(false);
            setConsentError(null);
          }}
          onConfirm={handleConsentDelete}
        >
          <p className="modal-confirm__text">
            Se eliminará «{document.name}». Puedes subir otro cuando quieras.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
