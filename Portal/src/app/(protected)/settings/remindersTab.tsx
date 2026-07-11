import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { useState } from "react";
import { useAuthContext } from "../../AuthContext";
import { useUpdateProfile, useUpdateProfileWithDebounce } from "@/src/api/useUpdateProfile";
import { User } from "@/src/types/User";
import { STATUS_ICONS } from "@/src/config/icons";
import { Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { validatePhoneNumber } from "@/src/utils/DataValidator";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";
import { CustomSelect } from "@/src/components/CustomSelect";

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

  const [ userPayload, setUserPayload ] = useState<Partial<User> | null>(null);
  const saveStatus = useUpdateProfileWithDebounce(userPayload);
  const { updateProfile } = useUpdateProfile()
  const [ error, setError ] = useState<string | null>(null);

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
    setUserPayload({
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
            Canal y preferencias de recordatorios
          </span>
        </div>
        <div className="dash-card__body">
          <div style={{ paddingTop: 5 }}>
            <label className="form-label">
              Canal de recordatorios para pacientes
              <CustomSelect
                value={reminderChannel ?? Channel.WHATSAPP}
                onChange={(value) => {
                  const channel = value as Channel;
                  setReminderChannel(channel);
                  updateProfile({ reminderChannel: channel });
                }}
                options={Object.values([ Channel.WHATSAPP, Channel.SMS ]).map((ch) => ({
                  value: ch,
                  label: CHANNEL_CFG[ ch ].label,
                }))}
              />
              <span className="form-input-hint">
                Todos los recordatorios enviados a tus pacientes (citas,
                notificaciones manuales y envíos masivos) usarán este
                canal. Asegúrate de que tus pacientes tengan el dato de
                contacto correspondiente registrado.
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
                Activa o desactiva los recordatorios automáticos de citas. El
                canal que configures aquí se usará para <strong>todos</strong>{" "}
                los recordatorios enviados a tus pacientes.
              </span>
              <label
                className="form-label"
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={reminderActive}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setReminderActive(checked);
                    updateProfile({ reminderActive: checked, whatsappNumber, phoneNumber });
                  }}
                />
                Activar recordatorios mios
              </label>
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
                    recordatorios diarios del sistema usando tu cannal selecionado arriba.
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
                  </div>
                </div>
              </>
            )}
            {error && (
              <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <STATUS_ICONS.warning size={14} /> {error}
              </div>
            )}
            {saveStatus === "saved" && (
              <SuccessBanner message="Preferencias de recordatorios actualizadas." />
            )}
            <SaveStatusIndicator status={saveStatus} showPill={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
