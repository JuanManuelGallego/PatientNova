import Link from "next/link";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { FieldError, InlineError } from "@/src/components/Info/InlineError";
import { useState } from "react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { useAutoSaveProfile } from "@/src/api/users/useUpdateProfile";
import { User } from "@/src/types/User";
import { Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { validatePhoneNumber } from "@/src/utils/DataValidator";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";
import { CustomSelect } from "@/src/components/CustomSelect";
import { Switch } from "@/src/components/Form/Switch";
import { settingsHref } from "@/src/config/navigation";
import { SettingsSection } from "./SettingsSection";

const WHATSAPP_ERROR_ID = "reminders-whatsapp-error";
const SMS_ERROR_ID = "reminders-sms-error";
const WHATSAPP_MISSING_ID = "reminders-whatsapp-missing";
const SMS_MISSING_ID = "reminders-sms-missing";

export function RemindersTab() {
  const { user } = useAuthContext();

  const [ phoneNumber, setPhoneNumber ] = useState(user?.phoneNumber ?? "");
  const [ whatsappNumber, setWhatsappNumber ] = useState(
    user?.whatsappNumber ?? "",
  );
  const [ reminderActive, setReminderActive ] = useState(
    user?.reminderActive ?? false,
  );
  const [ reminderChannel, setReminderChannel ] = useState<Channel | undefined>(
    user?.reminderChannel ?? undefined,
  );

  const autosave = useAutoSaveProfile();
  const [ whatsappError, setWhatsappError ] = useState<string | null>(null);
  const [ smsError, setSmsError ] = useState<string | null>(null);

  const validNumber = (value: string) => {
    const trimmed = value.trim();
    return trimmed && validatePhoneNumber(trimmed) ? trimmed : undefined;
  };

  function saveNow(overrides: Partial<User>) {
    autosave.schedule({
      phoneNumber: validNumber(phoneNumber),
      whatsappNumber: validNumber(whatsappNumber),
      reminderActive,
      reminderChannel,
      ...overrides,
    });
    autosave.flush();
  }

  function handleFieldChange(overrides: Partial<User> = {}) {
    const resolvedWhatsapp = overrides.whatsappNumber ?? whatsappNumber;
    const resolvedPhone = overrides.phoneNumber ?? phoneNumber;

    const badWhatsapp = !!resolvedWhatsapp && !validatePhoneNumber(resolvedWhatsapp);
    const badPhone = !!resolvedPhone && !validatePhoneNumber(resolvedPhone);
    setWhatsappError(badWhatsapp ? "Por favor, ingresa un número de WhatsApp válido (formato E.164)." : null);
    setSmsError(badPhone ? "Por favor, ingresa un número de SMS válido (formato E.164)." : null);
    if (badWhatsapp || badPhone) return;

    autosave.schedule({
      phoneNumber: resolvedPhone.trim() || undefined,
      whatsappNumber: resolvedWhatsapp.trim() || undefined,
      reminderActive: overrides.reminderActive ?? reminderActive,
      reminderChannel: overrides.reminderChannel ?? reminderChannel,
      ...overrides,
    });
  }

  const activeChannel = reminderChannel ?? Channel.WHATSAPP;
  const whatsappMissing = reminderActive && activeChannel === Channel.WHATSAPP && !whatsappNumber.trim();
  const smsMissing = reminderActive && activeChannel === Channel.SMS && !phoneNumber.trim();

  return (
    <div className="settings-stack">
      <SettingsSection
        title="Tus avisos"
        description="Agenda diaria, reservas en línea, respuestas de tus pacientes y envíos fallidos."
        status={
          <SaveStatusIndicator
            saving={autosave.saving}
            status={autosave.status}
            error={autosave.error}
            testId="reminders-save-state"
          />
        }
      >
        <div className="form-stack">
          <label className="form-label" data-testid="reminders-channel-selector">
            Canal de tus avisos
            <CustomSelect
              value={reminderChannel ?? Channel.WHATSAPP}
              onChange={(value) => {
                const channel = value as Channel;
                setReminderChannel(channel);
                saveNow({ reminderChannel: channel });
              }}
              options={Object.values(Channel).map((ch) => ({
                value: ch,
                label: CHANNEL_CFG[ ch ].label,
              }))}
            />
            <span className="form-input-hint">
              Los recordatorios a tus pacientes usan el canal de cada paciente.
            </span>
          </label>

          <div style={{ borderTop: "1px solid var(--c-gray-100)", paddingTop: 16 }}>
            <Switch
              checked={reminderActive}
              onChange={(checked) => {
                setReminderActive(checked);
                saveNow({ reminderActive: checked });
              }}
              label="Avisos automáticos"
              onText="Activados"
              offText="Desactivados"
              testId="reminders-active-toggle"
            />
            <span className="form-input-hint" style={{ display: "block", marginTop: 8 }}>
              No detiene los recordatorios a tus pacientes.
              {user?.portalEnabled && (
                <>
                  {" "}El de las reservas en línea está en{" "}
                  <Link href={settingsHref("booking")}>Reserva en línea</Link>.
                </>
              )}
            </span>
          </div>

          {reminderActive && (
            <div className="form-grid-2" style={{ borderTop: "1px solid var(--c-gray-100)", paddingTop: 16 }}>
              <label className="form-label">
                WhatsApp
                <CountryCodeInput
                  value={whatsappNumber || undefined}
                  onChange={(v) => {
                    setWhatsappNumber(v);
                    handleFieldChange({ whatsappNumber: v });
                  }}
                  aria-invalid={!!whatsappError || undefined}
                  aria-describedby={[whatsappError && WHATSAPP_ERROR_ID, whatsappMissing && WHATSAPP_MISSING_ID].filter(Boolean).join(" ") || undefined}
                  data-testid="reminders-whatsapp-input"
                />
                {whatsappError && <FieldError id={WHATSAPP_ERROR_ID} message={whatsappError} />}
                {whatsappMissing && (
                  <span id={WHATSAPP_MISSING_ID} role="status" className="form-input-hint" style={{ color: "var(--c-warning-dark)" }}>
                    No tienes un número de WhatsApp. No recibirás avisos hasta que lo agregues.
                  </span>
                )}
              </label>
              <label className="form-label">
                Teléfono (SMS)
                <CountryCodeInput
                  value={phoneNumber || undefined}
                  onChange={(value) => {
                    setPhoneNumber(value);
                    handleFieldChange({ phoneNumber: value });
                  }}
                  aria-invalid={!!smsError || undefined}
                  aria-describedby={[smsError && SMS_ERROR_ID, smsMissing && SMS_MISSING_ID].filter(Boolean).join(" ") || undefined}
                  data-testid="reminders-sms-input"
                />
                {smsError && <FieldError id={SMS_ERROR_ID} message={smsError} />}
                {smsMissing && (
                  <span id={SMS_MISSING_ID} role="status" className="form-input-hint" style={{ color: "var(--c-warning-dark)" }}>
                    No tienes un número para SMS. No recibirás avisos hasta que lo agregues.
                  </span>
                )}
              </label>
              <label className="form-label">
                Correo electrónico
                <input
                  className="form-input"
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  readOnly
                  data-testid="reminders-user-email"
                />
                <span className="form-input-hint">
                  Se usa el correo de tu cuenta cuando el canal es Email.
                </span>
              </label>
            </div>
          )}
          {autosave.error && <InlineError message={autosave.error} />}
        </div>
      </SettingsSection>
    </div>
  );
}
