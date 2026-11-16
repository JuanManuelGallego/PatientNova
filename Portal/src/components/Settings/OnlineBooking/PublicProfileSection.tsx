"use client";

import { useId, useState } from "react";
import {
    BookingSettings,
    BookingSettingsUpdate,
    MAX_BIO_LENGTH,
    MAX_CONTACT_HOURS_LENGTH,
    MAX_LEGAL_TEXT_LENGTH,
    MAX_SPECIALTY_LENGTH,
} from "@/src/types/Booking";
import { isE164, normalizePhone } from "@/src/utils/publicBooking";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { FieldError, InlineError } from "@/src/components/Info/InlineError";
import { useDebouncedSave } from "@/src/hooks/useDebouncedSave";
import { Switch } from "@/src/components/Form/Switch";
import { PROFILE_SECTION_ID, type SaveFn } from "./shared";
import { SettingsSection } from "../SettingsSection";

type ProfileForm = {
    specialty: string;
    bio: string;
    publicPhone: string;
    publicWhatsapp: string;
    legalName: string;
    privacyContact: string;
    contactHours: string;
};

function profileFormOf(s: BookingSettings): ProfileForm {
    return {
        specialty: s.specialty ?? "",
        bio: s.bio ?? "",
        publicPhone: s.publicPhone ?? "",
        publicWhatsapp: s.publicWhatsapp ?? "",
        legalName: s.legalName ?? "",
        privacyContact: s.privacyContact ?? "",
        contactHours: s.contactHours ?? "",
    };
}

const PHONE_FORMAT_ERROR = "Revisa el número: parece incompleto o demasiado largo.";

function parseProfile(form: ProfileForm) {
    const publicPhone = normalizePhone(form.publicPhone);
    const publicWhatsapp = normalizePhone(form.publicWhatsapp);
    const errors = {
        publicPhone: publicPhone && !isE164(publicPhone) ? PHONE_FORMAT_ERROR : null,
        publicWhatsapp: publicWhatsapp && !isE164(publicWhatsapp) ? PHONE_FORMAT_ERROR : null,
    };
    const body = {
        specialty: form.specialty.trim() || null,
        bio: form.bio.trim() || null,
        publicPhone: publicPhone || null,
        publicWhatsapp: publicWhatsapp || null,
        legalName: form.legalName.trim() || null,
        privacyContact: form.privacyContact.trim() || null,
        contactHours: form.contactHours.trim() || null,
    } satisfies BookingSettingsUpdate;
    return { body, errors, invalid: Object.values(errors).some(Boolean) };
}

/** Saved at once, like the other switches: indexing is a choice, not a field being typed. */
function SearchVisibilityToggle({ settings, save, onSaved }: { settings: BookingSettings; save: SaveFn; onSaved: (s: BookingSettings) => void }) {
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    async function handleChange(searchIndexable: boolean) {
        setSaving(true);
        setError(null);
        try {
            onSaved(await save({ searchIndexable }));
        } catch {
            setError("No pudimos guardar este cambio. Inténtalo de nuevo.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{ borderBottom: "1px solid var(--c-gray-100)", paddingBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, color: "var(--c-gray-900)" }}>Aparecer en Google</span>
                <Switch
                    checked={settings.searchIndexable}
                    disabled={saving}
                    onChange={handleChange}
                    label="Aparecer en Google"
                    testId="online-booking-search-indexable"
                />
            </div>
            <span className="form-input-hint" style={{ display: "block", marginTop: 8 }}>
                Permite que Google y otros buscadores muestren tu página de reservas, con tu nombre, especialidad y presentación,
                mientras las reservas estén abiertas. Desactivado, solo la encuentra quien tiene tu enlace.
                Los buscadores pueden tardar algunos días en reflejar el cambio.
            </span>
            {error && <InlineError message={error} />}
        </div>
    );
}

export function PublicProfileSection({ settings, save, onSaved }: { settings: BookingSettings; save: SaveFn; onSaved: (s: BookingSettings) => void }) {
    const [ form, setForm ] = useState<ProfileForm>(() => profileFormOf(settings));
    const [ initial ] = useState(() => parseProfile(profileFormOf(settings)).body);
    const autosave = useDebouncedSave<BookingSettingsUpdate>(async (body) => onSaved(await save(body)), { initial });
    const { errors } = parseProfile(form);
    const ids = useId();

    function change(patch: Partial<ProfileForm>) {
        const next = { ...form, ...patch };
        setForm(next);
        const parsed = parseProfile(next);
        if (parsed.invalid) autosave.cancel();
        else autosave.schedule(parsed.body);
    }

    function phoneField(field: keyof typeof errors, label: string, hint: string, testId: string) {
        const err = errors[ field ];
        const errId = `${ids}-${field}-error`;
        return (
            <label className="form-label">
                {label}
                <CountryCodeInput
                    value={form[ field ] || undefined}
                    onChange={(v) => change({ [ field ]: v })}
                    aria-invalid={!!err}
                    aria-describedby={err ? errId : undefined}
                    data-testid={testId}
                />
                {err ? <FieldError id={errId} message={err} /> : <span className="form-input-hint">{hint}</span>}
            </label>
        );
    }

    return (
        <SettingsSection title="Tu página pública" status={<SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="online-booking-profile-save-state" />} id={PROFILE_SECTION_ID}>
            <div className="form-stack" data-testid="online-booking-profile">
                <span className="form-input-hint" style={{ alignSelf: "flex-start" }}>
                    Todo lo que escribas aquí es visible para cualquier persona con tu enlace de reserva.
                </span>
                <SearchVisibilityToggle settings={settings} save={save} onSaved={onSaved} />
                <label className="form-label">
                    Especialidad
                    <input className="form-input" maxLength={MAX_SPECIALTY_LENGTH} placeholder="Psicología clínica"
                        value={form.specialty} onChange={(e) => change({ specialty: e.target.value })} data-testid="online-booking-specialty" />
                </label>
                <label className="form-label">
                    Presentación
                    <textarea className="form-input form-input--textarea" rows={4} maxLength={MAX_BIO_LENGTH}
                        placeholder="Cuéntales a tus pacientes a quién atiendes y cómo trabajas."
                        value={form.bio} onChange={(e) => change({ bio: e.target.value })} data-testid="online-booking-bio" />
                    <span className="form-input-hint">{form.bio.length} de {MAX_BIO_LENGTH} caracteres</span>
                </label>
                <div className="form-grid-2">
                    {phoneField("publicPhone", "Teléfono público", "Es independiente del teléfono de tu perfil.", "online-booking-public-phone")}
                    {phoneField("publicWhatsapp", "WhatsApp público", "Abre un chat contigo desde tu página de reservas.", "online-booking-public-whatsapp")}
                </div>
                <span className="form-input-hint" style={{ alignSelf: "flex-start" }}>
                    Obligatorio para abrir las reservas: el paciente ve quién responde por sus datos y cómo contactarte sin usar el portal. Agrega también un teléfono o WhatsApp público.
                </span>
                <label className="form-label">
                    Nombre legal del responsable
                    <input className="form-input" maxLength={MAX_LEGAL_TEXT_LENGTH} placeholder="Tu nombre completo o el de tu consultorio"
                        value={form.legalName} onChange={(e) => change({ legalName: e.target.value })} data-testid="online-booking-legal-name" />
                </label>
                <label className="form-label">
                    Contacto de privacidad
                    <input className="form-input" maxLength={MAX_LEGAL_TEXT_LENGTH} placeholder="Correo o teléfono para solicitudes sobre datos"
                        value={form.privacyContact} onChange={(e) => change({ privacyContact: e.target.value })} data-testid="online-booking-privacy-contact" />
                </label>
                <label className="form-label">
                    Horario de atención directa
                    <input className="form-input" maxLength={MAX_CONTACT_HOURS_LENGTH} placeholder="Lunes a viernes, 8:00 a 17:00"
                        value={form.contactHours} onChange={(e) => change({ contactHours: e.target.value })} data-testid="online-booking-contact-hours" />
                </label>
                {autosave.error && <InlineError message={autosave.error} />}
            </div>
        </SettingsSection>
    );
}
