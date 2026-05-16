import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { useState } from "react";
import { useAuthContext } from "../../AuthContext";
import { useUpdateProfile } from "@/src/api/useUpdateProfile";
import { User } from "@/src/types/User";
import { Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { validatePhoneNumber } from "@/src/utils/DataValidator";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";

export function RemindersTab() {
    const { user } = useAuthContext();

    const [ phoneNumber, setPhoneNumber ] = useState(user?.phoneNumber ?? "");
    const [ whatsappNumber, setWhatsappNumber ] = useState(user?.whatsappNumber ?? "");
    const [ reminderActive, setReminderActive ] = useState(user?.reminderActive ?? false);
    const [ reminderChannel, setReminderChannel ] = useState<Channel | undefined>(user?.reminderChannel ?? undefined);

    const [ userPayload, setUserPayload ] = useState<Partial<User> | null>(null);
    const saveStatus = useUpdateProfile(userPayload);
    const [ error, setError ] = useState<string | null>(null);

    function handleFieldChange(overrides: Partial<User> = {}) {
        setError(null);
        const resolvedWhatsapp = overrides.whatsappNumber ?? whatsappNumber;
        const resolvedPhone = overrides.phoneNumber ?? phoneNumber;

        if (resolvedWhatsapp && !validatePhoneNumber(resolvedWhatsapp)) {
            setError("Por favor, ingresa un número de WhatsApp válido (formato E.164).");
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
                    <span className="dash-card__title">Recordatorios de citas del proximo dia y de actualizaciones de cita</span>
                </div>
                <div className="dash-card__body">
                    <div className="form-stack">
                        <div style={{ borderTop: "1px solid var(--c-gray-100)", paddingTop: 16 }}>
                            <span className="form-input-hint" style={{ marginBottom: 12, display: "block" }}>
                                Activa o desactiva los recordatorios y elige el canal por el cual deseas recibirlos.
                            </span>
                            <label className="form-label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <input type="checkbox" checked={reminderActive} onChange={e => {
                                    const checked = e.target.checked;
                                    setReminderActive(checked);
                                    handleFieldChange({ reminderActive: checked });
                                }} />
                                Activar recordatorios
                            </label>
                        </div>
                        {reminderActive && (
                            <>
                                <div style={{ borderTop: "1px solid var(--c-gray-100)", paddingTop: 16 }}>
                                    <span className="form-input-hint" style={{ marginBottom: 12, display: "block" }}>
                                        Estos datos se usan para recibir notificaciones sobre tus citas
                                    </span>
                                    <div className="form-grid-2">
                                        <label className="form-label">
                                            Teléfono (SMS)
                                            <CountryCodeInput
                                                value={phoneNumber || undefined}
                                                onChange={value => {
                                                    setPhoneNumber(value);
                                                    handleFieldChange({ phoneNumber: value });
                                                }}
                                            />
                                        </label>
                                        <label className="form-label">
                                            WhatsApp
                                            <CountryCodeInput
                                                value={whatsappNumber || undefined}
                                                onChange={v => {
                                                    setWhatsappNumber(v);
                                                    handleFieldChange({ whatsappNumber: v });
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                                <div style={{ paddingTop: 5 }}>
                                    <label className="form-label">
                                        Canal de recordatorio
                                        <select className="form-input" value={reminderChannel} onChange={e => {
                                            const ch = e.target.value as Channel;
                                            setReminderChannel(ch);
                                            handleFieldChange({ reminderChannel: ch });
                                        }}>
                                            <option value={Channel.SMS}>{CHANNEL_CFG[ Channel.SMS ].iconAndLabel}</option>
                                            <option value={Channel.WHATSAPP}>{CHANNEL_CFG[ Channel.WHATSAPP ].iconAndLabel}</option>
                                            <option value={Channel.EMAIL}>{CHANNEL_CFG[ Channel.EMAIL ].iconAndLabel}</option>
                                        </select>
                                        <span className="form-input-hint">Elige el canal por el cual deseas recibir los recordatorios</span>
                                    </label>
                                </div>
                            </>
                        )}
                        {error && <div className="error-inline">⚠️ {error}</div>}
                        {saveStatus === "saved" && <SuccessBanner message="Preferencias de recordatorios actualizadas." />}
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                            <span style={{ fontSize: 12, color: "var(--c-gray-400)", alignSelf: "center" }}>
                                {saveStatus === "saved" && "✓ Guardado"}
                                {saveStatus === "error" && "✗ Error al guardar"}
                                {saveStatus === "idle" && ""}
                            </span>
                        </div>
                    </div>
                </div>
            </div >
        </div >
    )
}

