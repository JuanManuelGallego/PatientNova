"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ApiClientError } from "@/src/api/base/apiClients";
import { usePortalSession } from "@/src/api/portal/usePortalSession";
import { useCreateBooking } from "@/src/api/portal/usePortalBooking";
import type { PublicAppointmentType, PublicProvider, PublicSlot } from "@/src/types/PublicBooking";
import type { PortalAppointment } from "@/src/types/PortalBooking";
import { fmtTime } from "@/src/utils/TimeUtils";
import { fmtCop, fmtLongDay, isE164, localDayOf, normalizePhone } from "@/src/utils/publicBooking";
import { ErrorState } from "./PublicStates";
import { PortalLogin, SESSION_LOST_NOTICE } from "./PortalLogin";
import portal from "./Portal.module.css";
import styles from "./PublicBooking.module.css";

interface BookingFormProps {
    slug: string;
    provider: PublicProvider;
    type: PublicAppointmentType;
    slot: PublicSlot;
    timezone: string;
    onBooked: (appointment: PortalAppointment) => void;
    onSlotTaken: (message: string) => void;
}

export function BookingForm({ slug, provider, type, slot, timezone, onBooked, onSlotTaken }: BookingFormProps) {
    const [ locationId, setLocationId ] = useState(provider.locations[ 0 ]?.id ?? "");
    const location = provider.locations.find((l) => l.id === locationId);

    return (
        <div className={styles.confirm}>
            <dl className={styles.summary}>
                <div>
                    <dt>Cita</dt>
                    <dd>{type.name} · {type.durationMinutes} minutos{type.price !== null && ` · ${fmtCop(type.price)}`}</dd>
                </div>
                <div>
                    <dt>Fecha</dt>
                    <dd>{fmtLongDay(localDayOf(slot.startUtc, timezone))}, {fmtTime(slot.startUtc, timezone)}</dd>
                </div>
                {provider.locations.length === 1 && location && (
                    <div>
                        <dt>Lugar</dt>
                        <dd>{location.name}{location.address && `, ${location.address}`}</dd>
                    </div>
                )}
            </dl>

            {provider.locations.length > 1 && (
                <div role="group" aria-label="Lugar">
                    <p className={styles.period}>Lugar</p>
                    <div className={styles.options}>
                        {provider.locations.map((l) => (
                            <button key={l.id} type="button" className={styles.option} aria-pressed={l.id === locationId}
                                onClick={() => setLocationId(l.id)}>
                                <span className={styles.optionName}>{l.name}</span>
                                {l.address && <span className={styles.optionMeta}>{l.address}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <PatientStep slug={slug} typeId={type.id} locationId={locationId} slot={slot} timezone={timezone}
                onBooked={onBooked} onSlotTaken={onSlotTaken} />
        </div>
    );
}

interface PatientStepProps {
    slug: string;
    typeId: string;
    locationId: string;
    slot: PublicSlot;
    timezone: string;
    onBooked: (appointment: PortalAppointment) => void;
    onSlotTaken: (message: string) => void;
}

function PatientStep({ slug, ...rest }: PatientStepProps) {
    const { session, loading, error, refetch, clear } = usePortalSession();
    const [ notice, setNotice ] = useState<string | undefined>();

    if (loading) return <div className="skeleton-bar" style={{ height: 44 }} aria-busy="true" aria-label="Cargando" />;
    if (error) return <ErrorState error={error} onRetry={refetch} inline />;
    if (!session || session.providerSlug !== slug.trim().toLowerCase()) {
        return (
            <PortalLogin slug={slug} embedded title="Confirma tu correo" notice={notice}
                onLoggedIn={() => { setNotice(undefined); refetch(); }} />
        );
    }
    return <PatientDetails email={session.email} {...rest} onSessionLost={() => { setNotice(SESSION_LOST_NOTICE); clear(); }} />;
}

function PatientDetails({ email, typeId, locationId, slot, timezone, onBooked, onSlotTaken, onSessionLost }:
    Omit<PatientStepProps, "slug"> & { email: string; onSessionLost: () => void }) {
    const [ name, setName ] = useState("");
    const [ lastName, setLastName ] = useState("");
    const [ phone, setPhone ] = useState("");
    const [ consent, setConsent ] = useState(false);
    const phoneHintId = useId();
    const { createBooking, loading, error } = useCreateBooking();

    const phoneValue = normalizePhone(phone);
    const phoneInvalid = phoneValue !== "" && !isE164(phoneValue);
    const canSubmit = !!name.trim() && !!lastName.trim() && !phoneInvalid && consent && !!locationId && !loading;

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        try {
            const appointment = await createBooking({
                typeId,
                locationId,
                startUtc: slot.startUtc,
                patientTimezone: timezone,
                consentAccepted: true,
                patient: { name: name.trim(), lastName: lastName.trim(), ...(phoneValue && { phone: phoneValue }) },
            });
            onBooked(appointment);
        } catch (err) {
            if (!(err instanceof ApiClientError)) return;
            if (err.status === 401) onSessionLost();
            else if (/slot no longer available/i.test(err.details ?? "")) onSlotTaken(err.message);
        }
    };

    return (
        <form className={portal.form} onSubmit={onSubmit}>
            <p className={portal.lead}>Reservarás con el correo <strong className={portal.email}>{email}</strong>.</p>
            <label className="form-label">
                Nombre
                <input className="form-input" name="name" autoComplete="given-name" required maxLength={100}
                    value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="form-label">
                Apellidos
                <input className="form-input" name="lastName" autoComplete="family-name" required maxLength={100}
                    value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <div>
                <label className="form-label">
                    Teléfono (opcional)
                    <input className="form-input" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={24}
                        placeholder="+57 300 123 4567" aria-invalid={phoneInvalid || undefined} aria-describedby={phoneHintId}
                        value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <span id={phoneHintId} className={portal.fieldHint}>
                    {phoneInvalid ? "Escríbelo con el indicativo del país, por ejemplo +57 300 123 4567." : "Con el indicativo del país."}
                </span>
            </div>
            <p className={portal.muted}>Si ya eres paciente del consultorio, usaremos los datos que tiene registrados.</p>
            <label className={portal.checkbox}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                    Acepto el tratamiento de mis datos personales según la{" "}
                    <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">Política de privacidad</Link>.
                </span>
            </label>
            {error && <p className={`error-inline ${portal.error}`} role="alert">{error}</p>}
            <button type="submit" className={`btn-primary ${portal.submit}`} disabled={!canSubmit}>
                {loading ? "Reservando…" : "Reservar cita"}
            </button>
        </form>
    );
}
