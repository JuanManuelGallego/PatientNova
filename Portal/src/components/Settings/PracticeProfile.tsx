import { useAutoSaveProfile } from "@/src/api/users/useUpdateProfile";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { InlineError } from "@/src/components/Info/InlineError";
import { TextField } from "@/src/components/Form/TextField";
import { ImageField } from "@/src/components/Form/ImageField";
import { User } from "@/src/types/User";
import { useState } from "react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { SettingsSection } from "./SettingsSection";

type BankingFields = {
  bankName: string;
  accountNumber: string;
  nationalId: string;
  bankingKey: string;
};

type PracticeSection = "logos" | "banking";

export function PracticeProfile() {
  const { user } = useAuthContext();

  const [ fields, setFields ] = useState<BankingFields>(() => ({
    bankName: user?.bankName ?? "",
    accountNumber: user?.accountNumber ?? "",
    nationalId: user?.nationalId ?? "",
    bankingKey: user?.bankingKey ?? "",
  }));
  const [ logo, setLogo ] = useState<string | null>(user?.logo ?? null);
  const [ altLogo, setAltLogo ] = useState<string | null>(user?.altLogo ?? null);

  const autosave = useAutoSaveProfile();
  const [ activeSection, setActiveSection ] = useState<PracticeSection | null>(null);
  const [ imageError, setImageError ] = useState<{ section: PracticeSection; message: string } | null>(null);

  function saveIndicator(section: PracticeSection) {
    if (activeSection !== section) return null;
    return <SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="profile-save-state" />;
  }

  function sectionError(section: PracticeSection) {
    const message = imageError?.section === section
      ? imageError.message
      : activeSection === section ? autosave.error : null;
    if (!message) return null;
    return <div style={{ marginTop: 12 }}><InlineError message={message} /></div>;
  }

  function scheduleSave(section: PracticeSection, overrides: Partial<User> = {}) {
    setImageError(null);
    setActiveSection(section);
    autosave.schedule({
      logo: (overrides.logo ?? logo) || undefined,
      altLogo: (overrides.altLogo ?? altLogo) || undefined,
      bankName: (overrides.bankName ?? fields.bankName).trim() || undefined,
      accountNumber: (overrides.accountNumber ?? fields.accountNumber).trim() || undefined,
      nationalId: (overrides.nationalId ?? fields.nationalId).trim() || undefined,
      bankingKey: (overrides.bankingKey ?? fields.bankingKey).trim() || undefined,
      ...overrides,
    });
  }

  function setField<K extends keyof BankingFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [ key ]: value }));
    scheduleSave("banking", { [ key ]: value } as Partial<User>);
  }

  function imageErrorFor(section: PracticeSection) {
    return (message: string) => setImageError(message ? { section, message } : null);
  }

  return (
    <div className="settings-stack">
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
            onChange={(v) => setField("bankName", v)}
            placeholder="Bancolombia"
          />
          <TextField
            label="Número de cuenta"
            value={fields.accountNumber}
            onChange={(v) => setField("accountNumber", v)}
            placeholder="123465789"
          />
          <TextField
            label="Cédula"
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
        {sectionError("banking")}
      </SettingsSection>
    </div>
  );
}
