import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import styles from "./PublicChrome.module.css";

const LEGAL_LINK_TARGET = { target: "_blank", rel: "noopener noreferrer" } as const;

export function PublicFooter() {
    return (
        <footer className={styles.footer}>
            <div className={styles.footerInner}>
                <div className={styles.footerBrand}>
                    <Image src="/favicon.ico" alt="" width={28} height={28} sizes="28px" className={styles.footerLogo} />
                    <p>Agenda en línea por <strong>Patient Nova</strong></p>
                </div>
                <nav aria-label="Legal y soporte">
                    <ul className={styles.footerLinks}>
                        <li><a href="/privacy-policy" {...LEGAL_LINK_TARGET}>Política de privacidad</a></li>
                        <li><a href="/patient-terms" {...LEGAL_LINK_TARGET}>Condiciones del portal</a></li>
                        <li><a href="/terms-of-service" {...LEGAL_LINK_TARGET}>Términos para profesionales</a></li>
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

export function BookingProgress({ steps, current }: { steps: string[]; current: number }) {
    const label = `Paso ${current} de ${steps.length} · ${steps[ current - 1 ]}`;
    return (
        <div className={styles.progress} role="progressbar" aria-label="Progreso de la reserva"
            aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={current} aria-valuetext={label}>
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
