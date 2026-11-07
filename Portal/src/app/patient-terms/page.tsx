import Link from "next/link";

export const metadata = {
  title: "Condiciones del portal | Patient Nova",
  description: "Condiciones de uso del portal de pacientes de Patient Nova.",
};

// Keep this as a fixed revision date. It must change when this document changes.
const lastUpdated = "6 de noviembre de 2026";

const sections = [
  {
    id: "use",
    title: "Condiciones de uso del portal",
    content: [
      "Patient Nova proporciona este portal a tu clínica o profesional para gestionar citas. No presta atención médica ni atiende urgencias.",
      "No compartas códigos o enlaces de acceso. Una solicitud sujeta a revisión no está confirmada hasta que la clínica la apruebe. Las reglas de atención, cancelación y reprogramación de la clínica se muestran antes de la reserva.",
      "Comunica errores o problemas de acceso al contacto de tu clínica. Puedes ejercer tus derechos sobre datos sin utilizar el portal.",
      "Estas condiciones no contienen renuncias a tus derechos, indemnizaciones a favor del operador ni límites a responsabilidades legales.",
    ],
  },
];

export default function PatientTermsPage() {
  return (
    <>
      <main className="legal-page">
        <div className="legal-container">
          <header className="legal-header">
            <h1 className="legal-title">Condiciones del portal para pacientes</h1>
            <p className="legal-last-updated">Última actualización: {lastUpdated}</p>
          </header>

          <div className="legal-content">
            <nav className="legal-toc" aria-label="Tabla de contenidos">
              <ul>
                {sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.title}</a>
                  </li>
                ))}
              </ul>
            </nav>

            <article>
              {sections.map((section) => (
                <section key={section.id} id={section.id} className="legal-section">
                  <h2 className="legal-section-title">{section.title}</h2>
                  <div className="legal-section-body">
                    {section.content.map((paragraph, idx) => (
                      <p key={idx} className="legal-paragraph">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </div>
      </main>

      <footer className="legal-footer">
        <div className="legal-footer-inner">
          <Link href="/" className="legal-footer-link">
            Patient Nova
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/login" className="legal-footer-link">
            Iniciar sesión
          </Link>
        </div>
      </footer>
    </>
  );
}
