"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiClientError } from "@/src/api/base/apiClients";
import { useStartBooking } from "@/src/api/portal/useBookingConfirmation";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";
import { TurnstileWidget, type TurnstileHandle } from "@/src/components/TurnstileWidget";
import { accessNotice } from "@/src/config/consentText";
import type { BookingPending, StartBookingRequest } from "@/src/types/PortalBooking";
import type { PublicAppointmentType, PublicLocation, PublicProvider, PublicSlot } from "@/src/types/PublicBooking";
import { APPROVAL_FOLLOW_UP, fmtBookingPolicy, isE164, PHONE_FORMAT_HINT } from "@/src/utils/publicBooking";
import { ConsentLabel, ConsentNotice } from "./ConsentNotice";
import { ContactChoiceField, type ConfirmationChannel } from "./ContactChoiceField";
import { StepScreen } from "./StepScreen";
import type { BookingStep } from "./useBookingFlow";
import portal from "./Portal.module.css";
import styles from "./BookingFlow.module.css";

export const BOOKING_CAPTCHA_ACTION = "booking";

export interface DetailsForm {
    name: string;
    lastName: string;
    channel: ConfirmationChannel;
    email: string;
    whatsapp: string;
    phone: string;
    consent: boolean;
}

export const EMPTY_DETAILS: DetailsForm = { name: "", lastName: "", channel: "EMAIL", email: "", whatsapp: "", phone: "", consent: false };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = "name" | "lastName" | "contact" | "phone" | "consent";

interface PatientDetailsStepProps {
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
    form: DetailsForm;
    onForm: (patch: Partial<DetailsForm>) => void;
    onPending: (pending: BookingPending) => void;
    onSlotTaken: (message: string) => void;
}

export function PatientDetailsStep({ slug, provider, type, location, slot, timezone, steps, step, moved, onBack, summary, form, onForm, onPending, onSlotTaken }: PatientDetailsStepProps) {
    const { name, lastName, email, whatsapp, phone, consent } = form;
    const { approvalRequired, displayName: providerName, whatsappConfirmation } = provider;
    const channels: ConfirmationChannel[] = whatsappConfirmation ? [ "EMAIL", "WHATSAPP" ] : [ "EMAIL" ];
    const channel = whatsappConfirmation ? form.channel : "EMAIL";
    const [ attempted, setAttempted ] = useState(false);
    const [ touched, setTouched ] = useState({ contact: false, phone: false });
    const [ captchaToken, setCaptchaToken ] = useState<string | null>(null);
    const ids = useId();
    const formId = `${ids}-form`;
    const widget = useRef<TurnstileHandle>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const lastNameRef = useRef<HTMLInputElement>(null);
    const contactRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const consentRef = useRef<HTMLInputElement>(null);
    const { startBooking, loading, error, reset } = useStartBooking(slug);

    if (step !== "details" || !type || !location || !slot) return null;

    const byEmail = channel === "EMAIL";
    const invalid: Record<Field, boolean> = {
        name: !name.trim(),
        lastName: !lastName.trim(),
        contact: byEmail ? !EMAIL_SHAPE.test(email.trim()) : !isE164(whatsapp),
        phone: byEmail && phone !== "" && !isE164(phone),
        consent: !consent,
    };
    const shown: Record<Field, boolean> = {
        name: attempted && invalid.name,
        lastName: attempted && invalid.lastName,
        contact: (attempted || touched.contact) && invalid.contact,
        phone: (attempted || touched.phone) && invalid.phone,
        consent: attempted && invalid.consent,
    };
    const errorId = (field: Field) => `${ids}-${field}-error`;

    const chooseChannel = (next: ConfirmationChannel) => {
        onForm({ channel: next });
        setTouched((t) => ({ ...t, contact: false }));
        reset();
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (loading || !captchaToken) return;
        const firstInvalid = (Object.keys(invalid) as Field[]).find((f) => invalid[ f ]);
        if (firstInvalid) {
            setAttempted(true);
            ({ name: nameRef, lastName: lastNameRef, contact: contactRef, phone: phoneRef, consent: consentRef })[ firstInvalid ].current?.focus();
            return;
        }
        const body: StartBookingRequest = {
            typeId: type.id,
            locationId: location.id,
            startUtc: slot.startUtc,
            patientTimezone: timezone,
            consentAccepted: true,
            captchaToken,
            patient: { name: name.trim(), lastName: lastName.trim(), ...(byEmail && phone && { phone }) },
            contact: byEmail ? { channel: "EMAIL", email: email.trim() } : { channel: "WHATSAPP", phone: whatsapp },
        };
        try {
            onPending(await startBooking(body));
        } catch (err) {
            if (!(err instanceof ApiClientError)) return;
            if (err.status === 409 && /whatsapp/i.test(err.details ?? "")) onForm({ channel: "EMAIL" });
            else if (err.status === 409 && /slot no longer available/i.test(err.details ?? "")) onSlotTaken(err.message);
        } finally {
            setCaptchaToken(null);
            widget.current?.reset();
        }
    };

    const submit = (
        <button type="submit" form={formId} className={`btn-primary ${styles.dockAction}`} disabled={loading || !captchaToken} aria-busy={loading || undefined}>
            {loading ? (approvalRequired ? "Enviando…" : "Reservando…") : (approvalRequired ? "Enviar solicitud" : "Reservar cita")}
        </button>
    );

    return (
        <StepScreen key={step} steps={steps} step={step} moved={moved} onBack={onBack} title="Último paso" dock={<>{summary}{submit}</>}>
            <form id={formId} className={portal.form} onSubmit={onSubmit} noValidate>
                <p className={portal.lead}>
                    Te enviaremos un enlace para confirmar tu {approvalRequired ? "solicitud" : "cita"}.
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
                <ContactChoiceField channels={channels} channel={channel} email={email} whatsapp={whatsapp} invalid={shown.contact} inputRef={contactRef}
                    onChannel={chooseChannel} onEmail={(value) => onForm({ email: value })} onWhatsapp={(value) => onForm({ whatsapp: value })}
                    onTouched={() => setTouched((t) => ({ ...t, contact: true }))} />
                <p className={styles.quiet} data-testid="access-notice">{accessNotice(provider)}</p>
                {byEmail && (
                    <div>
                        <div className="form-label">
                            <label htmlFor={`${ids}-phone`}>Teléfono (opcional)</label>
                            <CountryCodeInput ref={phoneRef} id={`${ids}-phone`} name="phone" autoComplete="tel" placeholder="300 123 4567"
                                aria-invalid={shown.phone || undefined} aria-describedby={shown.phone ? errorId("phone") : undefined}
                                value={phone} onChange={(value) => onForm({ phone: value })} onBlur={() => setTouched((t) => ({ ...t, phone: true }))} />
                        </div>
                        {shown.phone && <span id={errorId("phone")} className={portal.fieldError}>{PHONE_FORMAT_HINT}</span>}
                    </div>
                )}
                <ConsentNotice provider={provider} />
                <div>
                    <label className={portal.checkbox}>
                        <input ref={consentRef} type="checkbox" checked={consent} onChange={(e) => onForm({ consent: e.target.checked })}
                            aria-invalid={shown.consent || undefined} aria-describedby={shown.consent ? errorId("consent") : undefined} />
                        <ConsentLabel provider={provider} />
                    </label>
                    {shown.consent && (
                        <span id={errorId("consent")} className={`${portal.fieldError} ${portal.checkboxError}`}>
                            Marca la autorización para continuar, o contacta directamente a la clínica.
                        </span>
                    )}
                </div>
                {provider.selfServe && <p className={styles.quiet} data-testid="booking-policy">{fmtBookingPolicy(provider.reschedulePolicy)}</p>}
                <div className={portal.captcha}>
                    <TurnstileWidget ref={widget} action={BOOKING_CAPTCHA_ACTION} onToken={setCaptchaToken} />
                </div>
                {!captchaToken && <p className={portal.hint} aria-live="polite">Comprobando que eres una persona…</p>}
                {error && <p className={`error-inline ${portal.error}`} role="alert">{error}</p>}
            </form>
        </StepScreen>
    );
}
