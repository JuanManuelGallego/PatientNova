"use client";

import { useId, useRef, useState, type FormEvent } from "react";
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

const LOGIN_LEAD = "Ingresa tu correo y te enviaremos un código para confirmar tu reserva. No necesitas contraseña.";

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
    const placesLabelId = useId();

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
                {location && (
                    <div>
                        <dt>Lugar</dt>
                        <dd>{location.name}{location.address && `, ${location.address}`}</dd>
                    </div>
                )}
            </dl>

            {provider.locations.length > 1 && (
                <div role="group" aria-labelledby={placesLabelId}>
                    <p id={placesLabelId} className={styles.period}>Elige el lugar</p>
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
            <PortalLogin slug={slug} embedded title="Verifica tu correo" lead={LOGIN_LEAD} notice={notice}
                onLoggedIn={() => { setNotice(undefined); refetch(); }} />
        );
    }
    return <PatientDetails email={session.email} {...rest} onSessionLost={() => { setNotice(SESSION_LOST_NOTICE); clear(); }} />;
}

type Field = "name" | "lastName" | "phone" | "consent";

function PatientDetails({ email, typeId, locationId, slot, timezone, onBooked, onSlotTaken, onSessionLost }:
    Omit<PatientStepProps, "slug"> & { email: string; onSessionLost: () => void }) {
    const [ name, setName ] = useState("");
    const [ lastName, setLastName ] = useState("");
    const [ phone, setPhone ] = useState("");
    const [ consent, setConsent ] = useState(false);
    const [ attempted, setAttempted ] = useState(false);
    const [ phoneTouched, setPhoneTouched ] = useState(false);
    const ids = useId();
    const nameRef = useRef<HTMLInputElement>(null);
    const lastNameRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const consentRef = useRef<HTMLInputElement>(null);
    const { createBooking, loading, error } = useCreateBooking();

    const phoneValue = normalizePhone(phone);
    const invalid: Record<Field, boolean> = {
        name: !name.trim(),
        lastName: !lastName.trim(),
        phone: phoneValue !== "" && !isE164(phoneValue),
        consent: !consent,
    };
    const shown: Record<Field, boolean> = {
        name: attempted && invalid.name,
        lastName: attempted && invalid.lastName,
        phone: (attempted || phoneTouched) && invalid.phone,
        consent: attempted && invalid.consent,
    };
    const errorId = (field: Field) => `${ids}-${field}-error`;

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (loading) return;
        const firstInvalid = (Object.keys(invalid) as Field[]).find((f) => invalid[ f ]);
        if (firstInvalid || !locationId) {
            setAttempted(true);
            const refs = { name: nameRef, lastName: lastNameRef, phone: phoneRef, consent: consentRef };
            if (firstInvalid) refs[ firstInvalid ].current?.focus();
            return;
        }
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
        <form className={portal.form} onSubmit={onSubmit} noValidate>
            <p className={portal.lead}>
                Reservarás con el correo <strong className={portal.email}>{email}</strong>.{" "}
                Si ya eres paciente del consultorio, usaremos los datos que tiene registrados.
            </p>
            <div>
                <label className="form-label">
                    Nombre
                    <input ref={nameRef} className="form-input" name="name" autoComplete="given-name" required maxLength={100}
                        aria-invalid={shown.name || undefined} aria-describedby={shown.name ? errorId("name") : undefined}
                        value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                {shown.name && <span id={errorId("name")} className={portal.fieldError}>Escribe tu nombre.</span>}
            </div>
            <div>
                <label className="form-label">
                    Apellidos
                    <input ref={lastNameRef} className="form-input" name="lastName" autoComplete="family-name" required maxLength={100}
                        aria-invalid={shown.lastName || undefined} aria-describedby={shown.lastName ? errorId("lastName") : undefined}
                        value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </label>
                {shown.lastName && <span id={errorId("lastName")} className={portal.fieldError}>Escribe tus apellidos.</span>}
            </div>
            <div>
                <label className="form-label">
                    Teléfono (opcional)
                    <input ref={phoneRef} className="form-input" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={24}
                        placeholder="+57 300 123 4567" aria-invalid={shown.phone || undefined} aria-describedby={errorId("phone")}
                        value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => setPhoneTouched(true)} />
                </label>
                <span id={errorId("phone")} className={shown.phone ? portal.fieldError : portal.fieldHint}>
                    {shown.phone ? "Escríbelo con el indicativo del país, por ejemplo +57 300 123 4567." : "Con el indicativo del país."}
                </span>
            </div>
            <div>
                <label className={portal.checkbox}>
                    <input ref={consentRef} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                        aria-invalid={shown.consent || undefined} aria-describedby={shown.consent ? errorId("consent") : undefined} />
                    <span>
                        Acepto el tratamiento de mis datos personales según la{" "}
                        <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">Política de privacidad</Link>.
                    </span>
                </label>
                {shown.consent && (
                    <span id={errorId("consent")} className={`${portal.fieldError} ${portal.checkboxError}`}>
                        Acepta la política de privacidad para reservar.
                    </span>
                )}
            </div>
            {error && <p className={`error-inline ${portal.error}`} role="alert">{error}</p>}
            <button type="submit" className={`btn-primary ${portal.submit}`} disabled={loading} aria-busy={loading || undefined}>
                {loading ? "Reservando…" : "Reservar cita"}
            </button>
        </form>
    );
}
