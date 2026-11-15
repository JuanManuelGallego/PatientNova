import { useAutoSaveProfile } from "@/src/api/users/useUpdateProfile";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { InlineError } from "@/src/components/Info/InlineError";
import { TextField } from "@/src/components/Form/TextField";
import { ImageField } from "@/src/components/Form/ImageField";
import { User } from "@/src/types/User";
import { getInitials } from "@/src/utils/AvatarHelper";
import { COMMON_TIMEZONES } from "@/src/utils/TimeUtils";
import { useState } from "react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { CustomSelect } from "@/src/components/CustomSelect";
import { SettingsSection } from "./SettingsSection";

type AccountFields = {
  firstName: string;
  lastName: string;
  displayName: string;
  jobTitle: string;
};

type AccountSection = "photo" | "personal";

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

export function AccountProfile() {
  const { user } = useAuthContext();

  const [ fields, setFields ] = useState<AccountFields>(() => ({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    displayName: user?.displayName ?? "",
    jobTitle: user?.jobTitle ?? "",
  }));
  const [ timezone, setTimezone ] = useState(user?.timezone ?? "America/Bogota");
  const [ avatar, setAvatar ] = useState<string | null>(user?.avatar ?? null);

  const autosave = useAutoSaveProfile();
  const [ activeSection, setActiveSection ] = useState<AccountSection | null>(null);
  const [ imageError, setImageError ] = useState<string | null>(null);

  const initials = getInitials(
    user?.firstName?.[ 0 ] ?? "?",
    user?.lastName?.[ 0 ] ?? "?",
  );

  function saveIndicator(section: AccountSection) {
    if (activeSection !== section) return null;
    return <SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="profile-save-state" />;
  }

  function sectionError(section: AccountSection) {
    const message = section === "photo" && imageError
      ? imageError
      : activeSection === section ? autosave.error : null;
    if (!message) return null;
    return <div style={{ marginTop: 12 }}><InlineError message={message} /></div>;
  }

  function scheduleSave(section: AccountSection, overrides: Partial<User> = {}) {
    setImageError(null);
    setActiveSection(section);
    autosave.schedule({
      firstName: (overrides.firstName ?? fields.firstName).trim() || undefined,
      lastName: (overrides.lastName ?? fields.lastName).trim() || undefined,
      displayName: (overrides.displayName ?? fields.displayName).trim() || undefined,
      jobTitle: (overrides.jobTitle ?? fields.jobTitle).trim() || undefined,
      avatar: (overrides.avatar ?? avatar) || undefined,
      timezone: (overrides.timezone ?? timezone) || undefined,
      ...overrides,
    });
  }

  function setField<K extends keyof AccountFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [ key ]: value }));
    scheduleSave("personal", { [ key ]: value } as Partial<User>);
  }

  function handleTimezoneChange(value: string) {
    setTimezone(value);
    scheduleSave("personal", { timezone: value });
    autosave.flush();
  }

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
            onError={(message) => setImageError(message || null)}
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
              onChange={(v) => setField("firstName", v)}
              placeholder="Juan"
            />
            <TextField
              testId="profile-last-name-input"
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
            hint="Aparece en la barra lateral y en la vista general."
          />
          <TextField
            label="Cargo"
            value={fields.jobTitle}
            onChange={(v) => setField("jobTitle", v)}
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
    </div>
  );
}
