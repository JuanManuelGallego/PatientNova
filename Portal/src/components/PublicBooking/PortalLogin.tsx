"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { TurnstileWidget, type TurnstileHandle } from "@/src/components/TurnstileWidget";
import { useRequestOtp, useVerifyOtp } from "@/src/api/portal/usePortalAuth";
import styles from "./Portal.module.css";

export const RESEND_COOLDOWN_SECONDS = 60;
export const OTP_CAPTCHA_ACTION = "otp-request";
export const SESSION_LOST_NOTICE = "Tu sesión expiró. Ingresa de nuevo con tu correo.";
const CODE_LENGTH = 6;

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
    /** Inside the booking form: no card of its own, and an h2 under the page's h1. */
    embedded?: boolean;
}

export function PortalLogin({ slug, onLoggedIn, notice, title = "Mis citas", embedded = false }: PortalLoginProps) {
    const Heading = embedded ? "h2" : "h1";
    const ids = useId();
    const widget = useRef<TurnstileHandle>(null);
    const codeInput = useRef<HTMLInputElement>(null);
    const [ step, setStep ] = useState<"email" | "code">("email");
    const [ email, setEmail ] = useState("");
    const [ code, setCode ] = useState("");
    const [ captchaToken, setCaptchaToken ] = useState<string | null>(null);
    const [ captchaFailed, setCaptchaFailed ] = useState(false);
    const [ challenge, setChallenge ] = useState<string | null>(null);
    const [ sentTo, setSentTo ] = useState<string | null>(null);
    const [ cooldown, setCooldown ] = useCountdown();
    const request = useRequestOtp(slug);
    const onCaptchaToken = (token: string | null) => {
        setCaptchaToken(token);
        if (token) setCaptchaFailed(false);
    };
    const verify = useVerifyOtp(slug);

    const sendCode = async () => {
        if (!captchaToken || request.loading) return;
        verify.reset();
        try {
            const address = normalizeEmail(email);
            const result = await request.requestOtp(address, captchaToken);
            setChallenge(result.challenge);
            setSentTo(address);
            setCode("");
            setStep("code");
            setCooldown(RESEND_COOLDOWN_SECONDS);
        } catch {
        } finally {
            widget.current?.reset();
        }
    };

    const codeAlreadySent = challenge !== null && sentTo === normalizeEmail(email);

    const onSubmitEmail = (e: FormEvent) => {
        e.preventDefault();
        if (codeAlreadySent) {
            request.reset();
            setStep("code");
            return;
        }
        void sendCode();
    };

    const onSubmitCode = async (e: FormEvent) => {
        e.preventDefault();
        if (!challenge || !sentTo || code.length !== CODE_LENGTH || verify.loading) return;
        try {
            await verify.verifyOtp(sentTo, code, challenge);
            onLoggedIn();
        } catch {
            setCode("");
            codeInput.current?.focus();
        }
    };

    const changeEmail = () => {
        setStep("email");
        setCode("");
        request.reset();
        verify.reset();
    };

    const error = request.error ?? verify.error;

    return (
        <section className={embedded ? `${styles.card} ${styles.embedded}` : `dash-card ${styles.card}`} aria-labelledby={`${ids}-title`}>
            <Heading id={`${ids}-title`} className={styles.title}>{title}</Heading>
            {notice && <p className={styles.notice} role="status">{notice}</p>}

            {step === "email" ? (
                <form className={styles.form} onSubmit={onSubmitEmail}>
                    <p className={styles.lead}>Ingresa tu correo y te enviaremos un código para entrar. No necesitas contraseña.</p>
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
                    {error && <p className={`error-inline ${styles.error}`} role="alert">{error}</p>}
                    <button type="submit" className={`btn-primary ${styles.submit}`}
                        disabled={!email.trim() || request.loading || (!codeAlreadySent && !captchaToken)}>
                        {request.loading ? "Enviando…" : codeAlreadySent ? "Ingresar el código enviado" : "Enviar código"}
                    </button>
                    {!captchaToken && !captchaFailed && !codeAlreadySent && (
                        <p className={styles.hint} aria-live="polite">Comprobando que eres una persona…</p>
                    )}
                </form>
            ) : (
                <form className={styles.form} onSubmit={onSubmitCode}>
                    <p className={styles.lead} aria-live="polite">
                        Si el correo es válido, te enviamos un código a <strong className={styles.email}>{sentTo}</strong>.
                        Revisa también la carpeta de spam.
                    </p>
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
                            onClick={() => void sendCode()}>
                            {cooldown > 0 ? `Reenviar código (${cooldown} s)` : "Reenviar código"}
                        </button>
                        <button type="button" className={styles.linkButton} onClick={changeEmail}>Cambiar correo</button>
                    </div>
                </form>
            )}

            <div className={styles.captcha}>
                <TurnstileWidget ref={widget} action={OTP_CAPTCHA_ACTION} onToken={onCaptchaToken} onError={() => setCaptchaFailed(true)} />
            </div>
        </section>
    );
}
