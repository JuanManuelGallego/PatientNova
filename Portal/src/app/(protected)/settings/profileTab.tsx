import { useUpdateProfile, useUpdateProfileWithDebounce } from "@/src/api/useUpdateProfile";
import { useConsentDocument } from "@/src/api/useConsentDocument";
import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { TextField } from "@/src/components/Form/TextField";
import { ImageField } from "@/src/components/Form/ImageField";
import { User } from "@/src/types/User";
import { getInitials } from "@/src/utils/AvatarHelper";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { Upload, FileText, ClipboardList } from "lucide-react";
import { COMMON_TIMEZONES } from "@/src/utils/TimeUtils";
import { useState, useEffect, useRef } from "react";
import { useAuthContext } from "../../AuthContext";
import { CustomSelect } from "@/src/components/CustomSelect";

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

  const [ userPayload, setUserPayload ] = useState<Partial<User> | null>(null);
  const saveStatus = useUpdateProfileWithDebounce(userPayload);
  const { updateProfile } = useUpdateProfile();
  const [ error, setError ] = useState<string | null>(null);

  const {
    document,
    loading: docLoading,
    fetchDocument,
    uploadDocument,
    deleteDocument,
  } = useConsentDocument();
  const [ consentError, setConsentError ] = useState<string | null>(null);

  const consentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocument();
  }, [ fetchDocument ]);

  const initials = getInitials(
    user?.firstName?.[ 0 ] ?? "?",
    user?.lastName?.[ 0 ] ?? "?",
  );

  // ── Save ───────────────────────────────────────────────────────────────────

  function scheduleSave(overrides: Partial<User> = {}) {
    setError(null);
    setUserPayload({
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

  function setField<K extends keyof EditableFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [ key ]: value }));
    scheduleSave({ [ key ]: value } as Partial<User>);
  }

  function handleImageError(message: string) {
    setError(message || null);
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
    try {
      setConsentError(null);
      await deleteDocument();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al eliminar el documento";
      setConsentError(msg);
    }
  }

  // ── Timezone (immediate save, kept as-is) ───────────────────────────────────

  function handleTimezoneChange(value: string) {
    setTimezone(value);
    updateProfile({ timezone: value });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "272px 1fr",
        gap: 24,
        maxWidth: 880,
      }}
    >
      {/* Profile photo */}
      <div className="dash-card" style={{ height: "fit-content" }}>
        <div className="dash-card__header">
          <span className="dash-card__title">Foto de perfil</span>
        </div>
        <div
          className="dash-card__body"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <ImageField
            variant="circle"
            value={avatar}
            fallback={<AvatarFallback initials={initials} />}
            onChange={(value) => {
              setAvatar(value);
              scheduleSave({ avatar: value ?? undefined });
            }}
            onError={handleImageError}
            maxSide={256}
            format="image/jpeg"
            selectLabel="Seleccionar imagen"
            removeLabel="Eliminar foto"
          />
          <div
            style={{
              borderTop: "1px solid var(--c-gray-100)",
              paddingTop: 16,
              width: "100%",
            }}
          >
            <label className="form-label">
              Correo electrónico
              <p style={{ fontSize: 13, color: "var(--c-gray-400)", marginTop: 0 }}>
                {user?.email}
              </p>
            </label>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <div className="dash-card">
        <div className="dash-card__header">
          <span className="dash-card__title">Información personal</span>
        </div>
        <div className="dash-card__body">
          <div className="form-stack">
            <div className="form-grid-2">
              <TextField
                label="Nombre"
                value={fields.firstName}
                onChange={(v) => setField("firstName", v)}
                placeholder="Juan"
              />
              <TextField
                label="Apellido"
                value={fields.lastName}
                onChange={(v) => setField("lastName", v)}
                placeholder="García"
              />
            </div>
            <TextField
              label="Nombre en pantalla"
              value={fields.displayName}
              onChange={(v) => setField("displayName", v)}
              placeholder="Dr. Juan García"
              hint="Aparece en la barra lateral y en el dashboard"
            />
            <TextField
              label="Cargo"
              value={fields.jobTitle}
              onChange={(v) => setField("jobTitle", v)}
              placeholder="Médico general"
            />
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
                Afecta el cálculo de &quot;citas de hoy&quot; en el servidor
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Logos */}
      <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
        <div className="dash-card__header">
          <span className="dash-card__title">Logos</span>
        </div>
        <div className="dash-card__body">
          <p style={{ fontSize: 13, color: "var(--c-gray-400)", marginTop: 0 }}>
            Sube el logo principal y el alternativo (p. ej. versión oscura o
            monocromática). Formatos admitidos: PNG, SVG, WebP · Máx. 5 MB.
          </p>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}
          >
            <ImageField
              label="Logo principal"
              hint="Úsalo sobre fondos claros. Recomendado: fondo transparente."
              value={logo}
              onChange={(value) => {
                setLogo(value);
                scheduleSave({ logo: value ?? undefined });
              }}
              onError={handleImageError}
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
                scheduleSave({ altLogo: value ?? undefined });
              }}
              onError={handleImageError}
              maxSide={800}
              sizeErrorMessage="El logo debe ser menor a 5 MB"
              selectLabel="Subir"
              removeLabel="Eliminar"
            />
          </div>
        </div>
      </div>

      {/* Banking info */}
      <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
        <div className="dash-card__header">
          <span className="dash-card__title">Información Bancaria</span>
        </div>
        <div className="dash-card__body">
          <p style={{ fontSize: 13, color: "var(--c-gray-400)", marginTop: 0 }}>
            Información a mandar a tus pacientes para que puedan hacer el pago
            de sus consultas.
          </p>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}
          >
            <TextField
              label="Nombre del banco"
              value={fields.bankName}
              onChange={(v) => setField("bankName", v)}
              placeholder="Bancolombia"
            />
            <TextField
              label="Numero de cuenta"
              value={fields.accountNumber}
              onChange={(v) => setField("accountNumber", v)}
              placeholder="123465789"
            />
            <TextField
              label="Cedula"
              value={fields.nationalId}
              onChange={(v) => setField("nationalId", v)}
              placeholder="123456789"
            />
            <TextField
              label="Llave"
              value={fields.bankingKey}
              onChange={(v) => setField("bankingKey", v)}
              placeholder="@llaveBancolombia"
            />
          </div>
        </div>
      </div>

      {/* Consent form */}
      <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
        <div className="dash-card__header">
          <span className="dash-card__title">Formulario de Consentimiento</span>
        </div>
        <div className="dash-card__body">
          <p style={{ fontSize: 13, color: "var(--c-gray-400)", marginTop: 0 }}>
            Sube un formulario de consentimiento en PDF que tus pacientes
            deberán completar. Solo se permite un documento por usuario.
          </p>
          {document ? (
            <div
              style={{
                padding: 16,
                borderRadius: "var(--r-md)",
                border: "1px solid var(--c-gray-200)",
                background: "var(--c-gray-50)",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>
                    <FileText size={24} />
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--c-gray-900)",
                      }}
                    >
                      {document.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--c-gray-500)",
                        marginTop: 4,
                      }}
                    >
                      {(document.sizeBytes / 1024).toFixed(2)} KB · Actualizado{" "}
                      {new Date(document.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => consentRef.current?.click()}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Upload size={14} /> Reemplazar
                  </div>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, color: "var(--c-error)" }}
                  onClick={handleConsentDelete}
                  disabled={docLoading}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <ACTION_ICONS.delete size={14} /> Eliminar
                  </div>
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
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>
                <ClipboardList size={32} />
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--c-gray-500)",
                  margin: "0 0 12px 0",
                }}
              >
                No hay ningún formulario de consentimiento cargado
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => consentRef.current?.click()}
                disabled={docLoading}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Upload size={14} /> Subir PDF
                </div>
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
          <p style={{ fontSize: 12, color: "var(--c-gray-400)", margin: 0 }}>
            Formato: PDF · Máx. 10 MB
          </p>
        </div>
      </div>

      {error && (
        <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <STATUS_ICONS.warning size={14} /> {error}
        </div>
      )}
      {consentError && (
        <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <STATUS_ICONS.warning size={14} /> {consentError}
        </div>
      )}
      {saveStatus === "saved" && (
        <SuccessBanner message="Cambios guardados correctamente" />
      )}
      <SaveStatusIndicator status={saveStatus} />
    </div>
  );
}
