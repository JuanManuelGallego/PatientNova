"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";
import { TurnstileWidget, type TurnstileHandle } from "@/src/components/TurnstileWidget";
import { CHANNEL_ICONS } from "@/src/config/icons";
import { useRequestOtp, useVerifyOtp } from "@/src/api/portal/usePortalAuth";
import type { LoginChannel } from "@/src/types/PublicBooking";
import { fmtPhone, isE164, isPhoneChannel, PHONE_FORMAT_HINT } from "@/src/utils/publicBooking";
import styles from "./Portal.module.css";

export const RESEND_COOLDOWN_SECONDS = 60;
export const OTP_CAPTCHA_ACTION = "otp-request";
export const SESSION_LOST_NOTICE = "Tu sesión expiró. Ingresa de nuevo.";
const CODE_LENGTH = 6;
const EMAIL_ONLY: LoginChannel[] = [ "EMAIL" ];

const CHANNEL_LABELS: Record<LoginChannel, string> = { EMAIL: "Correo", WHATSAPP: "WhatsApp" };

const normalizeEmail = (value: string) => value.trim().toLowerCase();

function ChannelButton({ channel, selected, onSelect }: { channel: LoginChannel; selected: boolean; onSelect: (channel: LoginChannel) => void }) {
    const Icon = CHANNEL_ICONS[ channel ];
    return (
        <button type="button" className={styles.channel} aria-pressed={selected} onClick={() => onSelect(channel)}>
            <Icon size={18} aria-hidden="true" />
            {CHANNEL_LABELS[ channel ]}
        </button>
    );
}

/** Seconds until `until`. It runs on the clock, so it survives the form leaving the screen. */
function useCountdown(until: number) {
    const [ now, setNow ] = useState(() => Date.now());
    useEffect(() => {
        if (until <= now) return;
        const timer = setTimeout(() => setNow(Date.now()), 1000);
        return () => clearTimeout(timer);
    }, [ until, now ]);
    return [ Math.max(0, Math.ceil((until - now) / 1000)), setNow ] as const;
}

interface SentCode {
    channel: LoginChannel;
    contact: string;
    challenge: string;
}

export interface LoginDraft {
    step: "contact" | "code";
    channel: LoginChannel;
    email: string;
    phone: string;
    sent: SentCode | null;
    cooldownUntil: number;
}

const EMPTY_DRAFT: LoginDraft = { step: "contact", channel: "EMAIL", email: "", phone: "", sent: null, cooldownUntil: 0 };

/**
 * Login progress, held by whoever outlives the form. A flow that moves away and back must keep it:
 * returning to the same contact goes to the code step with no request, because a throttled request
 * breaks the code already sent.
 */
export function useLoginDraft() {
    const [ draft, setDraft ] = useState(EMPTY_DRAFT);
    const update = useCallback((patch: Partial<LoginDraft>) => setDraft((d) => ({ ...d, ...patch })), []);
    return { draft, update };
}

interface PortalLoginProps {
    slug: string;
    onLoggedIn: () => void;
    notice?: string;
    title?: string;
    lead?: string;
    embedded?: boolean;
    channels?: LoginChannel[] | undefined;
    draft?: ReturnType<typeof useLoginDraft>;
    /** For a parent that already shows a heading. */
    hideTitle?: boolean;
}

const DEFAULT_LEAD = "Te enviaremos un código para entrar. No necesitas contraseña.";

export function PortalLogin({
    slug, onLoggedIn, notice, title = "Mis citas", lead = DEFAULT_LEAD, embedded = false, channels = EMAIL_ONLY, draft: sharedDraft, hideTitle = false,
}: PortalLoginProps) {
    const Heading = embedded ? "h3" : "h1";
    const ids = useId();
    const widget = useRef<TurnstileHandle>(null);
    const codeInput = useRef<HTMLInputElement>(null);
    const ownDraft = useLoginDraft();
    const { draft, update } = sharedDraft ?? ownDraft;
    const { step, channel, email, phone, sent, cooldownUntil } = draft;
    const [ phoneTouched, setPhoneTouched ] = useState(false);
    const [ code, setCode ] = useState("");
    const [ captchaToken, setCaptchaToken ] = useState<string | null>(null);
    const [ captchaFailed, setCaptchaFailed ] = useState(false);
    const [ cooldown, syncClock ] = useCountdown(cooldownUntil);
    const request = useRequestOtp(slug);
    const onCaptchaToken = (token: string | null) => {
        setCaptchaToken(token);
        if (token) setCaptchaFailed(false);
    };
    const verify = useVerifyOtp(slug);

    const onPhone = isPhoneChannel(channel);
    const contact = onPhone ? phone : normalizeEmail(email);
    const contactValid = onPhone ? isE164(contact) : contact !== "";
    const phoneError = onPhone && phoneTouched && !contactValid;

    const sendCode = async (target: LoginChannel, to: string) => {
        if (!captchaToken || request.loading) return;
        verify.reset();
        try {
            const body = isPhoneChannel(target) ? { phone: to, channel: target } : { email: to };
            const result = await request.requestOtp(body, captchaToken);
            const now = Date.now();
            update({
                sent: { channel: target, contact: to, challenge: result.challenge },
                channel: target,
                step: "code",
                cooldownUntil: now + RESEND_COOLDOWN_SECONDS * 1000,
            });
            syncClock(now);
            setCode("");
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
            update({ step: "code" });
            return;
        }
        void sendCode(channel, contact);
    };

    const submitCode = async (value: string) => {
        if (!sent || value.length !== CODE_LENGTH || verify.loading) return;
        try {
            await verify.verifyOtp(isPhoneChannel(sent.channel) ? { phone: sent.contact } : { email: sent.contact }, value, sent.challenge);
            onLoggedIn();
        } catch {
            setCode("");
            codeInput.current?.focus();
        }
    };

    const onCodeChange = (value: string) => {
        const next = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
        // An extra digit typed after a complete code leaves `next` unchanged, and must not submit again.
        if (next === code) return;
        setCode(next);
        void submitCode(next);
    };

    const changeContact = () => {
        update({ step: "contact" });
        setCode("");
        request.reset();
        verify.reset();
    };

    const chooseChannel = (next: LoginChannel) => {
        update({ channel: next });
        request.reset();
    };

    const sentByPhone = sent !== null && isPhoneChannel(sent.channel);
    const error = request.error ?? verify.error;

    return (
        <section className={embedded ? `${styles.card} ${styles.embedded}` : `dash-card ${styles.card}`} aria-labelledby={hideTitle ? undefined : `${ids}-title`}>
            {!hideTitle && <Heading id={`${ids}-title`} className={styles.title}>{title}</Heading>}
            {notice && <p className={styles.notice} role="status">{notice}</p>}

            {step === "contact" ? (
                <form className={styles.form} onSubmit={onSubmitContact} noValidate={onPhone}>
                    <p className={styles.lead}>{lead}</p>
                    {channels.length > 1 && (
                        <div role="group" aria-labelledby={`${ids}-channels`}>
                            <p id={`${ids}-channels`} className={styles.channelLabel}>Recibir el código por</p>
                            <div className={styles.channels}>
                                {channels.map((c) => (
                                    <ChannelButton key={c} channel={c} selected={c === channel} onSelect={chooseChannel} />
                                ))}
                            </div>
                        </div>
                    )}
                    {onPhone ? (
                        <div>
                            <div className="form-label">
                                <label htmlFor={`${ids}-phone`}>Número de celular</label>
                                <CountryCodeInput
                                    id={`${ids}-phone`}
                                    name="phone"
                                    autoComplete="tel"
                                    placeholder="300 123 4567"
                                    aria-invalid={phoneError || undefined}
                                    aria-describedby={phoneError ? `${ids}-phone-error` : undefined}
                                    value={phone}
                                    onChange={(value) => update({ phone: value })}
                                    onBlur={() => setPhoneTouched(true)}
                                />
                            </div>
                            {phoneError && <span id={`${ids}-phone-error`} className={styles.fieldError}>{PHONE_FORMAT_HINT}</span>}
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
                                onChange={(e) => update({ email: e.target.value })}
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
                <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void submitCode(code); }}>
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
                            onChange={(e) => onCodeChange(e.target.value)}
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
