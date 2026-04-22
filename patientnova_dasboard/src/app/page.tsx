"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/src/app/AuthContext";
import { LoginModal } from "../components/Modals/LoginModal";

export default function LandingPage() {
  const [ loginOpen, setLoginOpen ] = useState(false);
  const { isAuthenticated, initializing } = useAuthContext();
  const router = useRouter();

  const content = {
    features: {
      title: "Todo lo que necesitas para gestionar tu clínica",
      subtitle:
        "Patient Nova centraliza todas tus operaciones clínicas en una plataforma intuitiva.",
      items: [
        {
          icon: "🪪",
          title: "Gestión de pacientes",
          desc: "Mantén un historial completo de cada paciente. Busca, filtra y accede a perfiles en segundos.",
        },
        {
          icon: "📝",
          title: "Citas",
          desc: "Agenda y gestiona citas con seguimiento de estado, registros de pagos e historial completo.",
        },
        {
          icon: "📆",
          title: "Calendario",
          desc: "Vista mensual para visualizar tu agenda de un vistazo con todas tus citas superpuestas.",
        },
        {
          icon: "🔔",
          title: "Recordatorios",
          desc: "Envía recordatorios automáticos para reducir ausencias y mantener informados a tus pacientes.",
        },
      ],
    },
    howItWorks: {
      title: "Comienza en minutos",
      steps: [
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
      ],
    },
  }

  useEffect(() => {
    if (!initializing && isAuthenticated) router.replace("/dashboard");
  }, [ initializing, isAuthenticated, router ]);

  // While checking session, render nothing to avoid flash
  if (initializing || isAuthenticated) return null;

  return (
    <>
      {loginOpen && (
        <LoginModal onClose={() => setLoginOpen(false)} />
      )}
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
            <button className="btn-primary" onClick={() => setLoginOpen(true)}>
              {"Iniciar sesión"}
            </button>
          </div>
        </div>
      </nav>
      <section className="landing-hero">
        <div className="landing-container">
          <div className="landing-hero__badge">Gestión clínica, reinventada</div>
          <h1 className="landing-hero__title">La plataforma moderna para profesionales de la salud</h1>
          <p className="landing-hero__subtitle">Gestiona pacientes, citas, recordatorios y toda tu práctica clínica — todo en un solo lugar.</p>
        </div>
      </section>
      <section className="landing-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Todo lo que necesitas para gestionar tu clínica</h2>
            <p className="landing-section-subtitle">Patient Nova centraliza todas tus operaciones clínicas en una plataforma intuitiva.</p>
          </div>
          <div className="landing-features-grid">
            {content.features.items.map((f, i) => (
              <div key={i} className="landing-feature-card">
                <span className="landing-feature-card__icon" role="img" aria-label={f.title}>{f.icon}</span>
                <h3 className="landing-feature-card__title">{f.title}</h3>
                <p className="landing-feature-card__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="landing-section landing-section--white">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Comienza en minutos</h2>
          </div>
          <div className="landing-steps">
            {content.howItWorks.steps.map((step, i) => (
              <div key={i} className="landing-step">
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
          <h2 className="landing-cta-banner__title">¿Listo para optimizar tu práctica clínica?</h2>
          <p className="landing-cta-banner__subtitle">Únete a los profesionales de la salud que confían en Patient Nova.</p>
          <p className="landing-cta-banner__subtitle">
            Contacta <a href={`mailto:juan.gallego.developer@gmail.com`} style={{ color: "white" }}> soporte</a> para iniciar tu registro.
          </p>
        </div>
      </section>
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
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "var(--c-brand)",
              }}
            >
              Patient Nova
            </span>
          </div>
          <p className="landing-footer__tagline">Gestión clínica moderna para profesionales de la salud.</p>
          <p className="landing-footer__copy">
            © {new Date().getFullYear()} Patient Nova. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </>
  );
}
