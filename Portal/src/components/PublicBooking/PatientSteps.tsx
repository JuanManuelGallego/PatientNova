"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ApiClientError } from "@/src/api/base/apiClients";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";
import { usePortalSession } from "@/src/api/portal/usePortalSession";
import { useCreateBooking } from "@/src/api/portal/usePortalBooking";
import type { LoginChannel, PublicAppointmentType, PublicLocation, PublicProvider, PublicSlot } from "@/src/types/PublicBooking";
import type { PortalBookingOutcome } from "@/src/types/PortalBooking";
import { APPROVAL_FOLLOW_UP, fmtBookingPolicy, fmtContact, isE164, isPhoneChannel, PHONE_FORMAT_HINT } from "@/src/utils/publicBooking";
import { ErrorState } from "./PublicStates";
import { PortalLogin, SESSION_LOST_NOTICE, useLoginDraft } from "./PortalLogin";
import { StepScreen } from "./StepScreen";
import type { BookingStep } from "./useBookingFlow";
import portal from "./Portal.module.css";
import styles from "./BookingFlow.module.css";

const LOGIN_LEAD = "Te enviaremos un código de 6 dígitos para confirmar tu reserva. No necesitas contraseña.";

interface PatientForm {
    name: string;
    lastName: string;
    phone: string;
    consent: boolean;
}

const EMPTY_FORM: PatientForm = { name: "", lastName: "", phone: "", consent: false };

interface PatientStepsProps {
    slug: string;
    provider: PublicProvider;
    type: PublicAppointmentType | undefined;
    location: PublicLocation | undefined;
    slot: PublicSlot | undefined;
    timezone: string;
    steps: BookingStep[];
    step: BookingStep;
    moved: boolean;
    onBack: (() => void) | undefined;
    summary: ReactNode;
    onVerified: (verified: boolean) => void;
    onSessionLost: () => void;
    onBooked: (outcome: PortalBookingOutcome) => void;
    onSlotTaken: (message: string) => void;
}

/**
 * Verification and the patient's details. It mounts when the patient first leaves Horario, so the page makes
 * no credentialed call before that, and it stays mounted through the earlier steps: going back loses neither
 * the code already sent nor what was typed.
 */
export function PatientSteps({ slug, provider, type, location, slot, timezone, steps, step, moved, onBack, summary, onVerified, onSessionLost, onBooked, onSlotTaken }: PatientStepsProps) {
    const { session, loading, error, refetch, clear } = usePortalSession();
    const login = useLoginDraft();
    const [ form, setForm ] = useState(EMPTY_FORM);
    const [ notice, setNotice ] = useState<string | undefined>();
    const contact = session?.providerSlug === slug.trim().toLowerCase() ? session : null;
    const verified = contact !== null;

    useEffect(() => { onVerified(verified); }, [ verified, onVerified ]);

    if ((step !== "verify" && step !== "details") || !type || !location || !slot) return null;
    const screen = { steps, step, moved, onBack, dock: summary };

    if (step === "verify") {
        return (
            <StepScreen key={step} {...screen} title={login.draft.step === "code" ? "Te enviamos un código" : "¿Dónde te enviamos el código?"}>
                {loading ? <div className="skeleton-bar" style={{ height: 44 }} aria-busy="true" aria-label="Cargando" />
                    : error ? <ErrorState error={error} onRetry={refetch} inline />
                    : (
                        <>
                            <PortalLogin slug={slug} embedded hideTitle draft={login} lead={LOGIN_LEAD} notice={notice} channels={provider.loginChannels}
                                onLoggedIn={() => { setNotice(undefined); refetch(); }} />
                            <p className={styles.quiet}>Tus datos están protegidos según la Ley 1581 de 2012.</p>
                        </>
                    )}
            </StepScreen>
        );
    }

    if (!contact) return null;
    return (
        <PatientDetails
            key={step}
            screen={screen}
            contact={contact.contact}
            contactChannel={contact.contactChannel}
            provider={provider}
            typeId={type.id}
            locationId={location.id}
            slot={slot}
            timezone={timezone}
            form={form}
            onForm={(patch) => setForm((f) => ({ ...f, ...patch }))}
            onBooked={onBooked}
            onSlotTaken={onSlotTaken}
            onSessionLost={() => {
                setNotice(SESSION_LOST_NOTICE);
                login.update({ step: "contact", sent: null });
                clear();
                onSessionLost();
            }}
        />
    );
}

type Field = "name" | "lastName" | "phone" | "consent";

interface PatientDetailsProps {
    screen: { steps: BookingStep[]; step: BookingStep; moved: boolean; dock: ReactNode };
    contact: string;
    contactChannel: LoginChannel;
    provider: PublicProvider;
    typeId: string;
    locationId: string;
    slot: PublicSlot;
    timezone: string;
    form: PatientForm;
    onForm: (patch: Partial<PatientForm>) => void;
    onBooked: (outcome: PortalBookingOutcome) => void;
    onSlotTaken: (message: string) => void;
    onSessionLost: () => void;
}

function PatientDetails({ screen, contact, contactChannel, provider, typeId, locationId, slot, timezone, form, onForm, onBooked, onSlotTaken, onSessionLost }: PatientDetailsProps) {
    const { name, lastName, phone, consent } = form;
    const { approvalRequired, displayName: providerName } = provider;
    const [ attempted, setAttempted ] = useState(false);
    const [ phoneTouched, setPhoneTouched ] = useState(false);
    const ids = useId();
    const formId = `${ids}-form`;
    const nameRef = useRef<HTMLInputElement>(null);
    const lastNameRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const consentRef = useRef<HTMLInputElement>(null);
    const { createBooking, loading, error } = useCreateBooking();

    const onPhone = isPhoneChannel(contactChannel);
    const phoneValue = onPhone ? "" : phone;
    const contactKind = onPhone ? "el número" : "el correo";
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
        if (firstInvalid) {
            setAttempted(true);
            const refs = { name: nameRef, lastName: lastNameRef, phone: phoneRef, consent: consentRef };
            refs[ firstInvalid ].current?.focus();
            return;
        }
        try {
            const outcome = await createBooking({
                typeId,
                locationId,
                startUtc: slot.startUtc,
                patientTimezone: timezone,
                consentAccepted: true,
                patient: { name: name.trim(), lastName: lastName.trim(), ...(phoneValue && { phone: phoneValue }) },
            });
            onBooked(outcome);
        } catch (err) {
            if (!(err instanceof ApiClientError)) return;
            if (err.status === 401) onSessionLost();
            else if (/slot no longer available/i.test(err.details ?? "")) onSlotTaken(err.message);
        }
    };

    const submit = (
        <button type="submit" form={formId} className={`btn-primary ${styles.dockAction}`} disabled={loading} aria-busy={loading || undefined}>
            {loading ? (approvalRequired ? "Enviando…" : "Reservando…") : (approvalRequired ? "Enviar solicitud" : "Reservar cita")}
        </button>
    );

    return (
        <StepScreen {...screen} title="Último paso" dock={<>{screen.dock}{submit}</>}>
            <form id={formId} className={portal.form} onSubmit={onSubmit} noValidate>
                <p className={portal.lead}>
                    {approvalRequired ? `Enviarás la solicitud con ${contactKind}` : `Reservarás con ${contactKind}`}{" "}
                    <strong className={portal.email}>{fmtContact(contact, contactChannel)}</strong>.{" "}
                    Si ya eres paciente de {providerName}, usaremos los datos que tiene registrados.
                </p>
                {approvalRequired && (
                    <p className={portal.lead} data-testid="booking-approval-note">
                        Guardaremos este horario mientras {providerName} revisa tu solicitud. {APPROVAL_FOLLOW_UP}
                    </p>
                )}
                <div>
                    <label className="form-label">
                        Nombre
                        <input ref={nameRef} className="form-input" name="name" autoComplete="given-name" required maxLength={100}
                            aria-invalid={shown.name || undefined} aria-describedby={shown.name ? errorId("name") : undefined}
                            value={name} onChange={(e) => onForm({ name: e.target.value })} />
                    </label>
                    {shown.name && <span id={errorId("name")} className={portal.fieldError}>Escribe tu nombre.</span>}
                </div>
                <div>
                    <label className="form-label">
                        Apellidos
                        <input ref={lastNameRef} className="form-input" name="lastName" autoComplete="family-name" required maxLength={100}
                            aria-invalid={shown.lastName || undefined} aria-describedby={shown.lastName ? errorId("lastName") : undefined}
                            value={lastName} onChange={(e) => onForm({ lastName: e.target.value })} />
                    </label>
                    {shown.lastName && <span id={errorId("lastName")} className={portal.fieldError}>Escribe tus apellidos.</span>}
                </div>
                {!onPhone && (
                    <div>
                        <div className="form-label">
                            <label htmlFor={`${ids}-phone`}>Teléfono (opcional)</label>
                            <CountryCodeInput ref={phoneRef} id={`${ids}-phone`} name="phone" autoComplete="tel" placeholder="300 123 4567"
                                aria-invalid={shown.phone || undefined} aria-describedby={shown.phone ? errorId("phone") : undefined}
                                value={phone} onChange={(value) => onForm({ phone: value })} onBlur={() => setPhoneTouched(true)} />
                        </div>
                        {shown.phone && <span id={errorId("phone")} className={portal.fieldError}>{PHONE_FORMAT_HINT}</span>}
                    </div>
                )}
                <div>
                    <label className={portal.checkbox}>
                        <input ref={consentRef} type="checkbox" checked={consent} onChange={(e) => onForm({ consent: e.target.checked })}
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
                <p className={styles.quiet} data-testid="booking-policy">{fmtBookingPolicy(provider.reschedulePolicy)}</p>
                {error && <p className={`error-inline ${portal.error}`} role="alert">{error}</p>}
            </form>
        </StepScreen>
    );
}
