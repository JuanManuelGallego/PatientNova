"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { TurnstileWidget, type TurnstileHandle } from "@/src/components/TurnstileWidget";
import { useRequestOtp, useVerifyOtp } from "@/src/api/portal/usePortalAuth";
import styles from "./Portal.module.css";

/** Matches the server's per-email resend cooldown. */
export const RESEND_COOLDOWN_SECONDS = 60;
export const OTP_CAPTCHA_ACTION = "otp-request";
const CODE_LENGTH = 6;

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
    /** Called once the session cookie is set; the parent reloads the session. */
    onLoggedIn: () => void;
}

/**
 * Email OTP login for one provider. Responses never say whether the email belongs to a patient,
 * so the copy stays neutral. The `challenge` from the latest request lives only in memory and is
 * sent with the code; a resend replaces it (two tabs requesting at once leave only the last working).
 */
export function PortalLogin({ slug, onLoggedIn }: PortalLoginProps) {
    const ids = useId();
    const widget = useRef<TurnstileHandle>(null);
    const codeInput = useRef<HTMLInputElement>(null);
    const [ step, setStep ] = useState<"email" | "code">("email");
    const [ email, setEmail ] = useState("");
    const [ code, setCode ] = useState("");
    const [ captchaToken, setCaptchaToken ] = useState<string | null>(null);
    const [ challenge, setChallenge ] = useState<string | null>(null);
    const [ cooldown, setCooldown ] = useCountdown();
    const request = useRequestOtp(slug);
    const verify = useVerifyOtp(slug);

    const sendCode = async () => {
        if (!captchaToken || request.loading) return;
        verify.reset();
        try {
            const result = await request.requestOtp(email.trim(), captchaToken);
            setChallenge(result.challenge);
            setCode("");
            setStep("code");
            setCooldown(RESEND_COOLDOWN_SECONDS);
        } catch {
            // `request.error` holds the Spanish message.
        } finally {
            // A token is single use: get a fresh one for the next request either way.
            widget.current?.reset();
        }
    };

    const onSubmitEmail = (e: FormEvent) => {
        e.preventDefault();
        void sendCode();
    };

    const onSubmitCode = async (e: FormEvent) => {
        e.preventDefault();
        if (!challenge || code.length !== CODE_LENGTH || verify.loading) return;
        try {
            await verify.verifyOtp(email.trim(), code, challenge);
            onLoggedIn();
        } catch {
            setCode("");
            codeInput.current?.focus();
        }
    };

    const changeEmail = () => {
        setStep("email");
        setCode("");
        setChallenge(null);
        setCooldown(0);
        request.reset();
        verify.reset();
    };

    const error = request.error ?? verify.error;

    return (
        <section className={`dash-card ${styles.card}`} aria-labelledby={`${ids}-title`}>
            <h1 id={`${ids}-title`} className={styles.title}>Mis citas</h1>

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
                        disabled={!captchaToken || !email.trim() || request.loading}>
                        {request.loading ? "Enviando…" : "Enviar código"}
                    </button>
                </form>
            ) : (
                <form className={styles.form} onSubmit={onSubmitCode}>
                    <p className={styles.lead} aria-live="polite">
                        Si el correo es válido, te enviamos un código a <strong className={styles.email}>{email.trim()}</strong>.
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

            {/* Mounted across both steps: the resend needs a fresh token too. */}
            <TurnstileWidget ref={widget} action={OTP_CAPTCHA_ACTION} onToken={setCaptchaToken} />
        </section>
    );
}
