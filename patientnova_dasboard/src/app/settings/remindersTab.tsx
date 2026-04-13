import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { useState } from "react";
import { useAuthContext } from "../AuthContext";
import { useUpdateProfile } from "@/src/api/useUpdateProfile";
import { User } from "@/src/types/User";
import { Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { validatePhoneNumber } from "@/src/utils/DataValidator";

export function RemindersTab() {
    const { user, updateUser } = useAuthContext();
    const { updateProfile, loading: saving, error: apiError } = useUpdateProfile();

    const [ phoneNumber, setPhoneNumber ] = useState(user?.phoneNumber ?? "");
    const [ whatsappNumber, setWhatsappNumber ] = useState(user?.whatsappNumber ?? "");
    const [ reminderActive, setReminderActive ] = useState(user?.reminderActive ?? false);
    const [ reminderChannel, setReminderChannel ] = useState<Channel | undefined>(user?.reminderChannel ?? undefined);

    const [ success, setSuccess ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault(); setSuccess(false); setError(null);
        if (whatsappNumber && !validatePhoneNumber(whatsappNumber)) {
            setError("Por favor, ingresa un número de WhatsApp válido (formato E.164).");
            return;
        }
        if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
            setError("Por favor, ingresa un número de SMS válido (formato E.164).");
            return;
        }
        try {
            const payload: Partial<User> = {
                phoneNumber: phoneNumber.trim() || undefined,
                whatsappNumber: whatsappNumber.trim() || undefined,
                reminderActive,
                reminderChannel,
            }
            const updated = await updateProfile(payload);

            updateUser(updated as User);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3500);
        } catch {
            setError(apiError ?? "Error al guardar");
        }
    }

    return (
        <div style={{ maxWidth: 660 }}>
            <div className="dash-card">
                <div className="dash-card__header">
                    <span className="dash-card__title">Recordatorios de citas del proximo dia</span>
                </div>
                <div className="dash-card__body">
                    <form className="form-stack" onSubmit={handleSave}>
                        <div style={{ borderTop: "1px solid var(--c-gray-100)", paddingTop: 16 }}>
                            <span className="form-input-hint" style={{ marginBottom: 12, display: "block" }}>
                                Activa o desactiva los recordatorios y elige el canal por el cual deseas recibirlos.
                            </span>
                            <label className="form-label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <input type="checkbox" checked={reminderActive} onChange={e => setReminderActive(e.target.checked)} />
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
                                            <input className="form-input" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+573001234567" />
                                        </label>
                                        <label className="form-label">
                                            WhatsApp
                                            <input className="form-input" type="tel" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="+573001234567" />
                                        </label>
                                    </div>
                                </div>
                                <div style={{ paddingTop: 5 }}>
                                    <label className="form-label">
                                        Canal de recordatorio
                                        <select className="form-input" value={reminderChannel} onChange={e => setReminderChannel(e.target.value as Channel)}>
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
                        {success && <SuccessBanner message="Preferencias de recordatorios actualizadas." />}
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                            <button type="submit" className="btn-primary" disabled={saving || ((reminderChannel === Channel.SMS && !validatePhoneNumber(phoneNumber)) || (reminderChannel === Channel.WHATSAPP && !validatePhoneNumber(whatsappNumber)))}>
                                {saving ? "Guardando…" : "Guardar cambios"}
                            </button>
                        </div>
                    </form>
                </div>
            </div >
        </div >
    )
}

