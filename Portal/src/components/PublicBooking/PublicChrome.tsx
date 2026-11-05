import Link from "next/link";
import { KeyRound, MailCheck, ShieldCheck, type LucideIcon } from "lucide-react";
import styles from "./PublicChrome.module.css";

const LEGAL_LINK_TARGET = { target: "_blank", rel: "noopener noreferrer" } as const;

export function PublicHeader({ appointmentsHref }: { appointmentsHref?: string }) {
    return (
        <header className={styles.header}>
            <div className={styles.headerInner}>
                <span className={styles.brand}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={styles.logo} src="/favicon.ico" alt="" width={32} height={32} />
                    Patient Nova
                </span>
                {appointmentsHref && (
                    <nav aria-label="Cuenta">
                        <Link href={appointmentsHref} className={styles.navLink}>Mis citas</Link>
                    </nav>
                )}
            </div>
        </header>
    );
}

export function PublicFooter() {
    return (
        <footer className={styles.footer}>
            <div className={styles.footerInner}>
                <p className={styles.footerBrand}>
                    Agenda en línea por <strong>Patient Nova</strong>
                </p>
                <nav aria-label="Legal y soporte">
                    <ul className={styles.footerLinks}>
                        <li><a href="/privacy-policy" {...LEGAL_LINK_TARGET}>Política de privacidad</a></li>
                        <li><a href="/terms-of-service" {...LEGAL_LINK_TARGET}>Términos de servicio</a></li>
                        <li><a href="mailto:support@patientnova.net">Soporte</a></li>
                    </ul>
                </nav>
                <p className={styles.footerNote}>
                    Tus datos personales se protegen y se tratan según la Ley 1581 de 2012.
                </p>
                <p className={styles.footerCopy}>© {new Date().getFullYear()} Patient Nova</p>
            </div>
        </footer>
    );
}

export function TrustStrip() {
    return (
        <ul className={styles.trust} aria-label="Garantías de la reserva">
            <li><ShieldCheck size={16} aria-hidden="true" />Datos protegidos</li>
            <li><KeyRound size={16} aria-hidden="true" />Sin contraseña</li>
            <li><MailCheck size={16} aria-hidden="true" />Confirmación por correo</li>
        </ul>
    );
}

export function BookingProgress({ steps, current }: { steps: string[]; current: number }) {
    const label = `Paso ${current} de ${steps.length}`;
    return (
        <div className={styles.progress} role="progressbar" aria-label="Progreso de la reserva"
            aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={current} aria-valuetext={`${label}: ${steps[ current - 1 ]}`}>
            <p className={styles.progressLabel}>{label}</p>
            <div className={styles.progressTrack}>
                {steps.map((step, i) => (
                    <span key={step} className={styles.progressSegment} data-done={i < current || undefined} />
                ))}
            </div>
        </div>
    );
}

export function StateIcon({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <span className={styles.iconBubble} aria-hidden="true">
            <Icon size={22} />
        </span>
    );
}
