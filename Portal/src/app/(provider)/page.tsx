import Link from "next/link";
import { Bell, CalendarDays, FileText, Link2, Lock, MessageCircle, ShieldCheck, Video } from "lucide-react";
import { LandingLoginButton, LandingSessionRedirect } from "@/src/components/Landing/LandingAuth";
import {
  MarketingContactButtons, MarketingCta, MarketingFooter, MarketingFrame, MarketingNav, MarketingNavActions,
} from "@/src/components/Landing/MarketingChrome";
import { HeroPhone } from "@/src/components/Landing/HeroPhone";
import { ProductShot } from "@/src/components/Landing/ProductShot";
import { SCREENSHOTS } from "@/src/components/Landing/screenshots";
import { Testimonials } from "@/src/components/Landing/Testimonials";
import { SITE_URL, SUPPORT_EMAIL, SUPPORT_WHATSAPP, WHATSAPP_CONTACT_HREF } from "@/src/config/site";
import { TESTIMONIALS } from "@/src/config/testimonials";
import { pageMetadata } from "@/src/utils/seo/pageMetadata";

export const metadata = pageMetadata({
  path: "/",
  title: "Patient Nova | Agenda, reservas en línea e historia clínica para tu consulta",
  description:
    "Software para profesionales de la salud: reservas en línea, recordatorios por WhatsApp, SMS y correo, calendario e historia clínica en un solo lugar.",
});

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
      email: SUPPORT_EMAIL,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SUPPORT_EMAIL,
        telephone: SUPPORT_WHATSAPP,
        availableLanguage: "Spanish",
      },
    },
  ],
};

const FEATURES = [
  {
    icon: Link2,
    title: "Reserva en línea",
    desc: "Tus pacientes eligen servicio, día y hora desde tu enlace, sin crear cuenta, y confirman por correo o WhatsApp.",
    href: "/reserva-en-linea",
  },
  {
    icon: Bell,
    title: "Recordatorios automáticos",
    desc: "Por WhatsApp, SMS o correo, en el momento que elijas. Menos ausencias, menos mensajes a mano.",
    href: "/recordatorios",
  },
  {
    icon: FileText,
    title: "Historia clínica",
    desc: "Antecedentes, notas de evolución, documentos y exportación a PDF, también para historias familiares.",
    href: "/historia-clinica",
  },
  {
    icon: CalendarDays,
    title: "Agenda y calendario",
    desc: "Tus citas, pagos y bloqueos en un calendario. Las reservas en línea nunca se cruzan con tu agenda.",
  },
  {
    icon: Video,
    title: "Citas virtuales",
    desc: "Conecta Google y las citas virtuales que reservan tus pacientes reciben su enlace de Meet solas.",
  },
  {
    icon: ShieldCheck,
    title: "Datos protegidos",
    desc: "Datos de pacientes cifrados, acceso por usuario y registro de actividad, bajo la Ley 1581 de 2012.",
  },
];

const TRUST = [
  { icon: Lock, text: "Datos de pacientes cifrados" },
  { icon: ShieldCheck, text: "Tratamiento de datos bajo la Ley 1581 de 2012" },
  { icon: MessageCircle, text: "Soporte en español por WhatsApp" },
];

const STEPS = [
  {
    num: "01",
    title: "Escríbenos",
    desc: "Por WhatsApp o por correo, cuéntanos sobre tu consulta. Nosotros creamos tu cuenta.",
  },
  {
    num: "02",
    title: "Configuramos tu consulta contigo",
    desc: "Tus servicios, tus consultorios o la opción virtual, y tu horario de atención. Te acompañamos en cada paso.",
  },
  {
    num: "03",
    title: "Comparte tu enlace",
    desc: "Publica tu enlace de reservas o su código QR y deja que tus pacientes agenden solos.",
  },
];

const QUICK_FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "¿Mis pacientes necesitan una cuenta?",
    a: "No. Reservan desde tu enlace y confirman con el enlace que reciben por correo o WhatsApp.",
  },
  {
    q: "¿Puedo aprobar cada reserva?",
    a: "Sí. Con el modo de aprobación, cada reserva llega a tus solicitudes y aparta el horario mientras decides.",
  },
  {
    q: "¿Funciona en el celular?",
    a: "Sí, en el navegador del computador, la tableta o el celular, para ti y para tus pacientes.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: (
      <>
        Escríbenos por <a href={WHATSAPP_CONTACT_HREF} target="_blank" rel="noopener noreferrer">WhatsApp</a> o
        a <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> y te contamos los planes y precios según tu
        consulta.
      </>
    ),
  },
];

export default function LandingPage() {
  return (
    <MarketingFrame>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c") }}
      />
      <LandingSessionRedirect />
      <MarketingNav
        action={
          <MarketingNavActions
            login={
              <LandingLoginButton className="landing-nav__login" testId="landing-login-button">
                Iniciar sesión
              </LandingLoginButton>
            }
          />
        }
      />
      <main>
        <section className="landing-hero landing-hero--split">
          <div className="landing-container landing-hero__grid">
            <div className="landing-hero__copy">
              <div className="landing-hero__badge">
                Para profesionales de la salud
              </div>
              <h1 className="landing-hero__title">
                Agenda, reservas en línea e historia clínica para tu consulta
              </h1>
              <p className="landing-hero__subtitle">
                Tus pacientes reservan desde un enlace y reciben recordatorios por WhatsApp, SMS o correo. Tú
                llevas la agenda y la historia clínica en el mismo lugar.
              </p>
              <MarketingContactButtons
                label="Quiero probarlo"
                testId="landing-cta-button"
                whatsappTestId="landing-cta-whatsapp"
              />
              <p className="landing-hero__note">Te ayudamos a configurar tu cuenta y tu enlace de reservas.</p>
            </div>
            <HeroPhone />
          </div>
        </section>
        <section className="landing-trust" aria-label="Seguridad y soporte">
          <ul className="landing-container landing-trust__list">
            {TRUST.map(({ icon: Icon, text }) => (
              <li key={text} className="landing-trust__item">
                <Icon size={18} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </section>
        <section className="landing-section">
          <div className="landing-container">
            <div className="landing-section-header">
              <h2 className="landing-section-title">
                Todo lo que necesitas para gestionar tu consulta
              </h2>
              <p className="landing-section-subtitle">
                Patient Nova reúne la agenda, las reservas, los recordatorios y la historia clínica en una
                plataforma pensada para tu consulta, sea cual sea tu especialidad.
              </p>
            </div>
            <div className="landing-features-grid">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className={f.href ? "landing-feature-card landing-feature-card--link" : "landing-feature-card"}
                  >
                    <span className="landing-feature-card__icon" aria-hidden="true">
                      <Icon size={28} />
                    </span>
                    <h3 className="landing-feature-card__title">{f.title}</h3>
                    <p className="landing-feature-card__desc">{f.desc}</p>
                    {f.href && (
                      <Link href={f.href} className="landing-feature-card__link">
                        Conoce más <span className="sr-only">sobre {f.title.toLowerCase()}</span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="landing-shot">
              <ProductShot shot={SCREENSHOTS.calendar} />
            </div>
          </div>
        </section>
        <section className="landing-section landing-section--white">
          <div className="landing-container">
            <div className="landing-section-header">
              <h2 className="landing-section-title">Así empiezas</h2>
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
        <section className="landing-section">
          <div className="landing-container marketing-prose">
            <h2>Preguntas frecuentes</h2>
            {QUICK_FAQS.map((f) => (
              <details key={f.q} className="marketing-faq">
                <summary><h3>{f.q}</h3></summary>
                <p>{f.a}</p>
              </details>
            ))}
            <p>
              <Link href="/preguntas-frecuentes">Ver todas las preguntas frecuentes</Link>
            </p>
          </div>
        </section>
        <Testimonials items={TESTIMONIALS} />
        <MarketingCta />
      </main>
      <MarketingFooter />
    </MarketingFrame>
  );
}
