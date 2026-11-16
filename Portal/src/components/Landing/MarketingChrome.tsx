import Image from "next/image";
import Link from "next/link";
import { MARKETING_PAGES, SUPPORT_EMAIL } from "@/src/config/site";

/**
 * The nav and footer shared by the landing page and the product pages (server components). The
 * footer links every product page, which is how crawlers and visitors find them from any page.
 */
export function MarketingNav({ action }: { action: React.ReactNode }) {
    return (
        <nav className="landing-nav">
            <div className="landing-nav__inner">
                <Link href="/" className="landing-nav__brand" style={{ textDecoration: "none" }}>
                    <Image
                        src="/favicon.ico"
                        alt="Patient Nova"
                        width={32}
                        height={32}
                        style={{ borderRadius: "var(--r-md)" }}
                    />
                    <span className="landing-nav__logo-text">Patient Nova</span>
                </Link>
                <div className="landing-nav__actions">{action}</div>
            </div>
        </nav>
    );
}

/** The login entry on pages without the auth provider: a plain link to the login page. */
export function MarketingLoginLink() {
    return (
        <Link href="/login" className="btn-primary" data-testid="marketing-login-link">
            Iniciar sesión
        </Link>
    );
}

export function MarketingCta() {
    return (
        <section className="landing-cta-banner">
            <div className="landing-container">
                <h2 className="landing-cta-banner__title">
                    ¿Listo para organizar tu consulta?
                </h2>
                <p className="landing-cta-banner__subtitle">
                    Escríbenos y te ayudamos a configurar tu cuenta, tus servicios y tu enlace de reservas.
                </p>
                <p className="landing-cta-banner__subtitle">
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="landing-cta-link">
                        {SUPPORT_EMAIL}
                    </a>
                </p>
            </div>
        </section>
    );
}

export function MarketingFooter() {
    return (
        <footer className="landing-footer">
            <div className="landing-container landing-footer__inner">
                <div className="landing-footer__brand">
                    <Image
                        src="/favicon.ico"
                        alt="Patient Nova"
                        width={22}
                        height={22}
                        style={{ borderRadius: "var(--r-sm)" }}
                    />
                    <span className="landing-footer__brand-text">Patient Nova</span>
                </div>
                <p className="landing-footer__tagline">
                    Agenda, reservas en línea e historia clínica para profesionales de la salud.
                </p>
                <nav className="landing-footer__links" aria-label="Producto">
                    {MARKETING_PAGES.map((p) => (
                        <Link key={p.path} href={p.path} className="landing-footer__link">
                            {p.label}
                        </Link>
                    ))}
                </nav>
                <div className="landing-footer__links">
                    <Link href="/privacy-policy" className="landing-footer__link">
                        Política de privacidad
                    </Link>
                    <span aria-hidden="true">·</span>
                    <Link href="/terms-of-service" className="landing-footer__link">
                        Términos de servicio
                    </Link>
                </div>
                <p className="landing-footer__copy">
                    © {new Date().getFullYear()} Patient Nova. Todos los derechos
                    reservados.
                </p>
            </div>
        </footer>
    );
}
