import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { useState } from "react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { useAutoSaveProfile } from "@/src/api/users/useUpdateProfile";
import { User } from "@/src/types/User";
import { STATUS_ICONS } from "@/src/config/icons";
import { Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { validatePhoneNumber } from "@/src/utils/DataValidator";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";
import { CustomSelect } from "@/src/components/CustomSelect";
import { Switch } from "@/src/components/Form/Switch";

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
  const [ error, setError ] = useState<string | null>(null);

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
    setError(null);
    const resolvedWhatsapp = overrides.whatsappNumber ?? whatsappNumber;
    const resolvedPhone = overrides.phoneNumber ?? phoneNumber;

    if (resolvedWhatsapp && !validatePhoneNumber(resolvedWhatsapp)) {
      setError(
        "Por favor, ingresa un número de WhatsApp válido (formato E.164).",
      );
      return;
    }
    if (resolvedPhone && !validatePhoneNumber(resolvedPhone)) {
      setError("Por favor, ingresa un número de SMS válido (formato E.164).");
      return;
    }
    autosave.schedule({
      phoneNumber: resolvedPhone.trim() || undefined,
      whatsappNumber: resolvedWhatsapp.trim() || undefined,
      reminderActive: overrides.reminderActive ?? reminderActive,
      reminderChannel: overrides.reminderChannel ?? reminderChannel,
      ...overrides,
    });
  }

  return (
    <div style={{ maxWidth: 660 }}>
      <div className="dash-card">
        <div className="dash-card__header">
          <span className="dash-card__title">
            Tus avisos
          </span>
          <SaveStatusIndicator
            saving={autosave.saving}
            status={autosave.status}
            error={autosave.error}
            testId="reminders-save-state"
          />
        </div>
        <div className="dash-card__body">
          <div style={{ paddingTop: 5 }}>
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
                Por aquí recibes tu agenda diaria, los avisos de reservas en
                línea y las alertas de recordatorios fallidos. Los
                recordatorios a tus pacientes salen por el canal de cada
                paciente, que eliges en su ficha.
              </span>
            </label>
          </div>
        </div>
        <div className="dash-card__body">
          <div className="form-stack">
            <div
              style={{
                borderTop: "1px solid var(--c-gray-100)",
                paddingTop: 16,
              }}
            >
              <span
                className="form-input-hint"
                style={{ marginBottom: 12, display: "block" }}
              >
                Activa o desactiva tus avisos automáticos. No detiene los
                recordatorios a tus pacientes: el de las citas reservadas en
                línea se configura en Reserva en línea.
              </span>
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
            </div>
            {reminderActive && (
              <>
                <div
                  style={{
                    borderTop: "1px solid var(--c-gray-100)",
                    paddingTop: 16,
                  }}
                >
                  <span
                    className="form-input-hint"
                    style={{ marginBottom: 12, display: "block" }}
                  >
                    Datos de contacto del profesional. Se usan para los
                    avisos del sistema por el canal que elegiste arriba.
                  </span>
                  <div className="form-grid-2">
                    <label className="form-label">
                      WhatsApp
                      <CountryCodeInput
                        value={whatsappNumber || undefined}
                        onChange={(v) => {
                          setWhatsappNumber(v);
                          handleFieldChange({ whatsappNumber: v });
                        }}
                      />
                    </label>
                    <label className="form-label">
                      Teléfono (SMS)
                      <CountryCodeInput
                        value={phoneNumber || undefined}
                        onChange={(value) => {
                          setPhoneNumber(value);
                          handleFieldChange({ phoneNumber: value });
                        }}
                      />
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
                </div>
              </>
            )}
            {error && (
              <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <STATUS_ICONS.warning size={14} /> {error}
              </div>
            )}
            {autosave.error && (
              <div className="error-inline" role="alert" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <STATUS_ICONS.warning size={14} /> {autosave.error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
