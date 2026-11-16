import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { CONTACT_HREF, MARKETING_PAGES, SUPPORT_EMAIL, WHATSAPP_CONTACT_HREF } from "@/src/config/site";

/*
 * The chrome shared by the landing page and the product pages (server components). The footer
 * links every product page, which is how crawlers and visitors find them from any page.
 */

/**
 * Marketing pages are light only, like /book: a provider who saved the dark theme would otherwise
 * get dark tokens on the hero gradient (near-black title on purple). `<body>` has already resolved
 * its color from the dark theme, so the frame sets its own.
 */
export function MarketingFrame({ children }: { children: React.ReactNode }) {
    return <div data-theme="light" className="marketing-frame">{children}</div>;
}

/** The sign-up: accounts are created by support, so contacting it is how a visitor starts. */
export function MarketingContactLink({ className, testId, children }: {
    className: string;
    testId: string;
    children: React.ReactNode;
}) {
    return (
        <a href={CONTACT_HREF} className={className} data-testid={testId}>
            {children}
        </a>
    );
}

/** The calls to action on the purple gradient: email (white) and WhatsApp (outlined) side by side. */
export function MarketingContactButtons({ label, testId, whatsappTestId }: {
    label: string;
    testId: string;
    whatsappTestId: string;
}) {
    return (
        <div className="landing-cta-actions">
            <MarketingContactLink className="landing-btn-on-dark" testId={testId}>
                {label}
            </MarketingContactLink>
            <a
                href={WHATSAPP_CONTACT_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn-on-dark landing-btn-on-dark--outline"
                data-testid={whatsappTestId}
            >
                <MessageCircle size={18} aria-hidden="true" />
                Escríbenos por WhatsApp
            </a>
        </div>
    );
}

/** The nav's actions: a quiet login for providers and the contact button for everyone else. */
export function MarketingNavActions({ login }: { login: React.ReactNode }) {
    return (
        <>
            {login}
            <MarketingContactLink className="btn-primary landing-nav__contact" testId="marketing-nav-contact">
                Quiero probarlo
            </MarketingContactLink>
        </>
    );
}

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
        <Link href="/login" className="landing-nav__login" data-testid="marketing-login-link">
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
                <MarketingContactButtons
                    label="Quiero probar Patient Nova"
                    testId="marketing-cta-contact"
                    whatsappTestId="marketing-cta-whatsapp"
                />
                <p className="landing-cta-banner__note">
                    O escríbenos directamente a{" "}
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
