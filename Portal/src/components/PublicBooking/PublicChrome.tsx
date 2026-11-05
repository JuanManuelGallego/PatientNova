import { Lock, MailCheck, ShieldCheck, type LucideIcon } from "lucide-react";
import styles from "./PublicChrome.module.css";

const LEGAL_LINK_TARGET = { target: "_blank", rel: "noopener noreferrer" } as const;

export function PublicHeader() {
    return (
        <header className={styles.header}>
            <div className={styles.headerInner}>
                <span className={styles.brand}>
                    <span className={styles.brandMark} aria-hidden="true"><ShieldCheck size={16} /></span>
                    Patient Nova
                </span>
                <span className={styles.secure}>
                    <Lock size={14} aria-hidden="true" />
                    Reserva segura
                </span>
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
                <nav aria-label="Legal y contacto">
                    <ul className={styles.footerLinks}>
                        <li><a href="/privacy-policy" {...LEGAL_LINK_TARGET}>Política de privacidad</a></li>
                        <li><a href="/terms-of-service" {...LEGAL_LINK_TARGET}>Términos de servicio</a></li>
                        <li><a href="mailto:privacidad@patientnova.net">Contacto</a></li>
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
            <li><Lock size={16} aria-hidden="true" />Sin contraseña</li>
            <li><MailCheck size={16} aria-hidden="true" />Confirmación por correo</li>
        </ul>
    );
}

export function StateIcon({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <span className={styles.iconBubble} aria-hidden="true">
            <Icon size={22} aria-hidden="true" />
        </span>
    );
}
