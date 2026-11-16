import type { Metadata } from "next";
import Image from "next/image";
import { Users, FileText, CalendarDays, Bell } from "lucide-react";
import { LandingLoginButton, LandingSessionRedirect } from "@/src/components/Landing/LandingAuth";
import { SITE_URL } from "@/src/config/site";

const TITLE = "Patient Nova | Gestión clínica para profesionales de la salud";
const DESCRIPTION =
  "Gestiona pacientes, citas, calendario y recordatorios automáticos de tu práctica clínica en un solo lugar.";

// A server component on purpose: search engines index the HTML, so the content must not wait on
// the session probe. Only the login buttons and the signed-in redirect run on the client.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Patient Nova",
    title: TITLE,
    description: DESCRIPTION,
    locale: "es_CO",
    // Declaring `openGraph` here drops the inherited `app/opengraph-image`, so list it again.
    images: [ { url: "/opengraph-image", width: 1200, height: 630, alt: "Patient Nova" } ],
  },
};

// Read by Google for the site name in results and the brand's logo and contact.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "Patient Nova",
      inLanguage: "es-CO",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Patient Nova",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon.png`,
      email: "support@patientnova.net",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "support@patientnova.net",
        availableLanguage: "Spanish",
      },
    },
  ],
};

const FEATURES = [
  {
    icon: Users,
    title: "Gestión de pacientes",
    desc: "Mantén un historial completo de cada paciente. Busca, filtra y accede a perfiles en segundos.",
  },
  {
    icon: FileText,
    title: "Citas",
    desc: "Agenda y gestiona citas con seguimiento de estado, registros de pagos e historial completo.",
  },
  {
    icon: CalendarDays,
    title: "Calendario",
    desc: "Vista mensual para visualizar tu agenda de un vistazo con todas tus citas superpuestas.",
  },
  {
    icon: Bell,
    title: "Recordatorios",
    desc: "Envía recordatorios automáticos para reducir ausencias y mantener informados a tus pacientes.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Inicia sesión de forma segura",
    desc: "Accede a tu dashboard con autenticación empresarial y gestión automática de sesiones.",
  },
  {
    num: "02",
    title: "Configura tu práctica",
    desc: "Agrega pacientes, configura tipos de citas y personaliza tu flujo de trabajo en minutos.",
  },
  {
    num: "03",
    title: "Gestiona de forma más inteligente",
    desc: "Sigue métricas clave, reduce ausencias y enfócate en lo que importa: tus pacientes.",
  },
];

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Escaped `<` keeps the JSON from closing the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c") }}
      />
      <LandingSessionRedirect />
      <nav className="landing-nav">
        <div className="landing-nav__inner">
          <div className="landing-nav__brand">
            <Image
              src="/favicon.ico"
              alt="Patient Nova"
              width={32}
              height={32}
              style={{ borderRadius: "var(--r-md)" }}
            />
            <span className="landing-nav__logo-text">Patient Nova</span>
          </div>
          <div className="landing-nav__actions">
            <LandingLoginButton className="btn-primary" testId="landing-login-button">
              Iniciar sesión
            </LandingLoginButton>
          </div>
        </div>
      </nav>
      <main>
        <section className="landing-hero">
          <div className="landing-container">
            <div className="landing-hero__badge">
              Gestión clínica, reinventada
            </div>
            <h1 className="landing-hero__title">
              La plataforma moderna para profesionales de la salud
            </h1>
            <p className="landing-hero__subtitle">
              Gestiona pacientes, citas, recordatorios y toda tu práctica clínica
              — todo en un solo lugar.
            </p>
            <LandingLoginButton className="btn-primary landing-hero__cta" testId="landing-cta-button">
              Comenzar ahora
            </LandingLoginButton>
          </div>
        </section>
        <section className="landing-section">
          <div className="landing-container">
            <div className="landing-section-header">
              <h2 className="landing-section-title">
                Todo lo que necesitas para gestionar tu clínica
              </h2>
              <p className="landing-section-subtitle">
                Patient Nova centraliza todas tus operaciones clínicas en una
                plataforma intuitiva.
              </p>
            </div>
            <div className="landing-features-grid">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="landing-feature-card">
                    <span
                      className="landing-feature-card__icon"
                      role="img"
                      aria-label={f.title}
                    >
                      <Icon size={28} />
                    </span>
                    <h3 className="landing-feature-card__title">{f.title}</h3>
                    <p className="landing-feature-card__desc">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className="landing-section landing-section--white">
          <div className="landing-container">
            <div className="landing-section-header">
              <h2 className="landing-section-title">Comienza en minutos</h2>
            </div>
            <div className="landing-steps">
              {STEPS.map((step) => (
                <div key={step.num} className="landing-step">
                  <div className="landing-step__num">{step.num}</div>
                  <h3 className="landing-step__title">{step.title}</h3>
                  <p className="landing-step__desc">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="landing-cta-banner">
          <div className="landing-container">
            <h2 className="landing-cta-banner__title">
              ¿Listo para optimizar tu práctica clínica?
            </h2>
            <p className="landing-cta-banner__subtitle">
              Únete a los profesionales de la salud que confían en Patient Nova.
            </p>
            <p className="landing-cta-banner__subtitle">
              Contacta
              <a
                href="mailto:support@patientnova.net"
                className="landing-cta-link"
              >
                {" soporte "}
              </a>
              para iniciar tu registro.
            </p>
          </div>
        </section>
      </main>
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
            Gestión clínica moderna para profesionales de la salud.
          </p>
          <div className="landing-footer__links">
            <a href="/privacy-policy" className="landing-footer__link">
              Política de privacidad
            </a>
            <span aria-hidden="true">·</span>
            <a href="/terms-of-service" className="landing-footer__link">
              Términos de servicio
            </a>
          </div>
          <p className="landing-footer__copy">
            © {new Date().getFullYear()} Patient Nova. Todos los derechos
            reservados.
          </p>
        </div>
      </footer>
    </>
  );
}
