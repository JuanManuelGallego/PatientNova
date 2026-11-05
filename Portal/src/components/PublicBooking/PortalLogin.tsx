"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { TurnstileWidget, type TurnstileHandle } from "@/src/components/TurnstileWidget";
import { useRequestOtp, useVerifyOtp } from "@/src/api/portal/usePortalAuth";
import type { LoginChannel } from "@/src/types/PublicBooking";
import { fmtPhone, isE164, isPhoneChannel, normalizePhone, PHONE_FORMAT_HINT } from "@/src/utils/publicBooking";
import styles from "./Portal.module.css";

export const RESEND_COOLDOWN_SECONDS = 60;
export const OTP_CAPTCHA_ACTION = "otp-request";
export const SESSION_LOST_NOTICE = "Tu sesión expiró. Ingresa de nuevo.";
const CODE_LENGTH = 6;
const EMAIL_ONLY: LoginChannel[] = [ "EMAIL" ];

const CHANNEL_LABELS: Record<LoginChannel, string> = { EMAIL: "Correo", WHATSAPP: "WhatsApp" };

const normalizeEmail = (value: string) => value.trim().toLowerCase();

function useCountdown() {
    const [ remaining, setRemaining ] = useState(0);
    useEffect(() => {
        if (remaining <= 0) return;
        const timer = setTimeout(() => setRemaining((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [ remaining ]);
    return [ remaining, setRemaining ] as const;
}

interface PortalLoginProps {
    slug: string;
    onLoggedIn: () => void;
    notice?: string;
    title?: string;
    lead?: string;
    embedded?: boolean;
    channels?: LoginChannel[] | undefined;
}

interface SentCode {
    channel: LoginChannel;
    contact: string;
    challenge: string;
}

const DEFAULT_LEAD = "Te enviaremos un código para entrar. No necesitas contraseña.";

export function PortalLogin({ slug, onLoggedIn, notice, title = "Mis citas", lead = DEFAULT_LEAD, embedded = false, channels = EMAIL_ONLY }: PortalLoginProps) {
    const Heading = embedded ? "h3" : "h1";
    const ids = useId();
    const widget = useRef<TurnstileHandle>(null);
    const codeInput = useRef<HTMLInputElement>(null);
    const [ step, setStep ] = useState<"contact" | "code">("contact");
    const [ channel, setChannel ] = useState<LoginChannel>("EMAIL");
    const [ email, setEmail ] = useState("");
    const [ phone, setPhone ] = useState("");
    const [ phoneTouched, setPhoneTouched ] = useState(false);
    const [ code, setCode ] = useState("");
    const [ captchaToken, setCaptchaToken ] = useState<string | null>(null);
    const [ captchaFailed, setCaptchaFailed ] = useState(false);
    const [ sent, setSent ] = useState<SentCode | null>(null);
    const [ cooldown, setCooldown ] = useCountdown();
    const request = useRequestOtp(slug);
    const onCaptchaToken = (token: string | null) => {
        setCaptchaToken(token);
        if (token) setCaptchaFailed(false);
    };
    const verify = useVerifyOtp(slug);

    const onPhone = isPhoneChannel(channel);
    const contact = onPhone ? normalizePhone(phone) : normalizeEmail(email);
    const contactValid = onPhone ? isE164(contact) : contact !== "";
    const phoneError = onPhone && phoneTouched && !contactValid;

    const sendCode = async (target: LoginChannel, to: string) => {
        if (!captchaToken || request.loading) return;
        verify.reset();
        try {
            const body = isPhoneChannel(target) ? { phone: to, channel: target } : { email: to };
            const result = await request.requestOtp(body, captchaToken);
            setSent({ channel: target, contact: to, challenge: result.challenge });
            setChannel(target);
            setCode("");
            setStep("code");
            setCooldown(RESEND_COOLDOWN_SECONDS);
        } catch {
        } finally {
            widget.current?.reset();
        }
    };

    const codeAlreadySent = sent !== null && sent.contact === contact && sent.channel === channel;

    const onSubmitContact = (e: FormEvent) => {
        e.preventDefault();
        if (codeAlreadySent) {
            request.reset();
            setStep("code");
            return;
        }
        void sendCode(channel, contact);
    };

    const onSubmitCode = async (e: FormEvent) => {
        e.preventDefault();
        if (!sent || code.length !== CODE_LENGTH || verify.loading) return;
        try {
            await verify.verifyOtp(isPhoneChannel(sent.channel) ? { phone: sent.contact } : { email: sent.contact }, code, sent.challenge);
            onLoggedIn();
        } catch {
            setCode("");
            codeInput.current?.focus();
        }
    };

    const changeContact = () => {
        setStep("contact");
        setCode("");
        request.reset();
        verify.reset();
    };

    const chooseChannel = (next: LoginChannel) => {
        setChannel(next);
        request.reset();
    };

    const sentByPhone = sent !== null && isPhoneChannel(sent.channel);
    const error = request.error ?? verify.error;

    return (
        <section className={embedded ? `${styles.card} ${styles.embedded}` : `dash-card ${styles.card}`} aria-labelledby={`${ids}-title`}>
            <Heading id={`${ids}-title`} className={styles.title}>{title}</Heading>
            {notice && <p className={styles.notice} role="status">{notice}</p>}

            {step === "contact" ? (
                <form className={styles.form} onSubmit={onSubmitContact} noValidate={onPhone}>
                    <p className={styles.lead}>{lead}</p>
                    {channels.length > 1 && (
                        <div role="group" aria-labelledby={`${ids}-channels`}>
                            <p id={`${ids}-channels`} className={styles.channelLabel}>Recibir el código por</p>
                            <div className={styles.channels}>
                                {channels.map((c) => (
                                    <button key={c} type="button" className={styles.channel} aria-pressed={c === channel}
                                        onClick={() => chooseChannel(c)}>
                                        {CHANNEL_LABELS[ c ]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {onPhone ? (
                        <div>
                            <label className="form-label">
                                Número de celular
                                <input
                                    className="form-input"
                                    type="tel"
                                    name="phone"
                                    autoComplete="tel"
                                    inputMode="tel"
                                    required
                                    maxLength={24}
                                    placeholder="+57 300 123 4567"
                                    aria-invalid={phoneError || undefined}
                                    aria-describedby={`${ids}-phone-hint`}
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    onBlur={() => setPhoneTouched(true)}
                                />
                            </label>
                            <span id={`${ids}-phone-hint`} className={phoneError ? styles.fieldError : styles.fieldHint}>
                                {phoneError ? PHONE_FORMAT_HINT : "Con el indicativo del país."}
                            </span>
                        </div>
                    ) : (
                        <label className="form-label">
                            Correo electrónico
                            <input
                                className="form-input"
                                type="email"
                                name="email"
                                autoComplete="email"
                                inputMode="email"
                                required
                                maxLength={254}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </label>
                    )}
                    {error && <p className={`error-inline ${styles.error}`} role="alert">{error}</p>}
                    <button type="submit" className={`btn-primary ${styles.submit}`}
                        disabled={!contactValid || request.loading || (!codeAlreadySent && !captchaToken)}>
                        {request.loading ? "Enviando…" : codeAlreadySent ? "Ingresar el código enviado" : "Enviar código"}
                    </button>
                    {!captchaToken && !captchaFailed && !codeAlreadySent && (
                        <p className={styles.hint} aria-live="polite">Comprobando que eres una persona…</p>
                    )}
                </form>
            ) : (
                <form className={styles.form} onSubmit={onSubmitCode}>
                    {sent && sentByPhone ? (
                        <p className={styles.lead} aria-live="polite">
                            Si el número es válido, te enviamos un código por {CHANNEL_LABELS[ sent.channel ]} a{" "}
                            <strong className={styles.email}>{fmtPhone(sent.contact)}</strong>.
                        </p>
                    ) : (
                        <p className={styles.lead} aria-live="polite">
                            Si el correo es válido, te enviamos un código a <strong className={styles.email}>{sent?.contact}</strong>.
                            Revisa también la carpeta de spam.
                        </p>
                    )}
                    <label className="form-label">
                        Código de 6 dígitos
                        <input
                            ref={codeInput}
                            className={`form-input ${styles.codeInput}`}
                            type="text"
                            name="code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="\d{6}"
                            maxLength={CODE_LENGTH}
                            required
                            autoFocus
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                        />
                    </label>
                    {error && <p className={`error-inline ${styles.error}`} role="alert">{error}</p>}
                    <button type="submit" className={`btn-primary ${styles.submit}`}
                        disabled={code.length !== CODE_LENGTH || verify.loading}>
                        {verify.loading ? "Verificando…" : "Ingresar"}
                    </button>
                    <div className={styles.secondaryActions}>
                        <button type="button" className={styles.linkButton}
                            disabled={cooldown > 0 || !captchaToken || request.loading}
                            onClick={() => { if (sent) void sendCode(sent.channel, sent.contact); }}>
                            {cooldown > 0 ? `Reenviar código (${cooldown} s)` : "Reenviar código"}
                        </button>
                        <button type="button" className={styles.linkButton} onClick={changeContact}>
                            {sentByPhone ? "Cambiar número" : "Cambiar correo"}
                        </button>
                    </div>
                </form>
            )}

            <div className={styles.captcha}>
                <TurnstileWidget ref={widget} action={OTP_CAPTCHA_ACTION} onToken={onCaptchaToken} onError={() => setCaptchaFailed(true)} />
            </div>
        </section>
    );
}
