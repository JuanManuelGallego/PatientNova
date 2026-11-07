import Link from "next/link";

export const metadata = {
  title: "Términos para profesionales | Patient Nova",
  description: "Términos que regulan el uso de Patient Nova por profesionales y entidades de salud.",
};

// Keep this as a fixed revision date. It must change when this document changes.
const lastUpdated = "6 de noviembre de 2026";

const sections = [
  {
    id: "parties",
    title: "1. Partes y aceptación",
    content: [
      "Patient Nova es operado por Juan Manuel Gallego, persona natural, con domicilio en Tv. 5 #75D-42, apto. 619, Medellín (Antioquia), Colombia (el «Operador»). Estos términos regulan la relación del Operador con el profesional o entidad que contrata el servicio. Quien acepta por una clínica declara tener facultades para hacerlo. La aceptación se registra al contratar o activar la cuenta.",
      "El paciente utiliza el portal bajo sus condiciones específicas; no asume por ello las obligaciones comerciales de la clínica.",
    ],
  },
  {
    id: "service",
    title: "2. Servicio",
    content: [
      "Ofrecemos herramientas para gestión de pacientes, citas, agenda, documentos, historia clínica y comunicaciones, y un portal de pacientes cuando la clínica lo habilita. Las funciones dependen de su configuración.",
      "Patient Nova no presta atención médica, no sustituye el criterio profesional y no sirve para emergencias. Una solicitud pendiente de aprobación no es una cita confirmada; la clínica debe informar sus reglas de atención y cambios.",
    ],
  },
  {
    id: "accounts",
    title: "3. Cuentas y acceso",
    content: [
      "Proporciona información exacta, protege las credenciales y concede únicamente accesos autorizados. Informa de accesos sospechosos y retira permisos cuando dejen de ser necesarios.",
      "La existencia de una cuenta no certifica identidad, licencia o habilitación profesional. La clínica es responsable de sus habilitaciones y de la exactitud de su perfil público. El Operador conserva sus propias obligaciones de seguridad y control del servicio.",
    ],
  },
  {
    id: "data",
    title: "4. Datos y acuerdo de tratamiento",
    content: [
      "La clínica mantiene los derechos y responsabilidades que le corresponden sobre su información y la de sus pacientes. Instruye a Patient Nova para tratarla exclusivamente dentro del servicio y del acuerdo de tratamiento aplicable.",
      "Antes de cargar datos personales debe formalizarse ese acuerdo, con instrucciones, confidencialidad, seguridad, proveedores, países, derechos, conservación, incidentes y salida. Estos términos no sustituyen las autorizaciones de los titulares. Patient Nova no adquiere permiso para reutilizar datos clínicos en publicidad u otras finalidades propias no acordadas y legalmente sustentadas.",
    ],
  },
  {
    id: "patients",
    title: "5. Obligaciones sobre pacientes",
    content: [
      "La clínica identifica al responsable del tratamiento, informa a los pacientes y obtiene y conserva las autorizaciones que sean exigibles, incluidas las garantías reforzadas para datos sensibles y menores. Debe comprobar a quién corresponde cada expediente y quién puede acceder.",
      "La autorización del portal no sustituye el consentimiento para actos médicos. La clínica debe mantener una vía real de atención fuera del portal, con contacto y horario publicados.",
    ],
  },
  {
    id: "communications",
    title: "6. Comunicaciones y terceros",
    content: [
      "La clínica debe utilizar contactos correctos, canales autorizados y contenido necesario. Debe tramitar solicitudes de cese y evitar que nuevas reservas o cambios reactiven mensajes rechazados.",
      "El servicio integra los proveedores indicados en la Política de privacidad. La entrega y disponibilidad de comunicaciones y reuniones dependen de terceros y no se garantizan en un momento determinado. Esta dependencia no exime al Operador de sus obligaciones legales o contractuales propias ni permite compartir datos fuera del alcance autorizado.",
    ],
  },
  {
    id: "prohibited",
    title: "7. Documentos y usos prohibidos",
    content: [
      "No utilices el servicio para acceso ajeno, suplantación, spam, fraude, malware, explotación no autorizada o divulgación indebida de información. No introduzcas datos sin fundamento válido ni documentos de pacientes en funciones de publicación de información general.",
      "Si detectas una exposición o fallo, comunícalo de forma privada y sin distribuir datos personales innecesarios.",
    ],
  },
  {
    id: "ip",
    title: "8. Propiedad intelectual",
    content: [
      "El software, la marca y los materiales del servicio pertenecen al Operador o sus licenciantes. Se concede un derecho de uso durante la vigencia del acceso. Esta licencia no transfiere al Operador la titularidad de los datos de la clínica o del paciente ni limita sus derechos legales de acceso y portabilidad.",
    ],
  },
  {
    id: "fees",
    title: "9. Precios",
    content: [
      "La versión actual no aplica suscripciones ni cobros de la cuenta dentro de la plataforma. Los precios y estados de pago de las citas son información de la clínica; no constituyen un cobro de Patient Nova. Cualquier futuro plan comercial deberá comunicarse y aceptarse con sus condiciones antes de aplicarse.",
    ],
  },
  {
    id: "liability",
    title: "10. Disponibilidad y responsabilidad",
    content: [
      "Las funcionalidades pueden requerir mantenimiento y depender de infraestructura externa. El Operador informará las limitaciones conocidas relevantes y actuará sobre fallos bajo su control. No garantiza disponibilidad continua ni entrega instantánea de mensajes.",
      "Cada parte responde por los incumplimientos y daños que legalmente le sean imputables. Estos términos no excluyen deberes de privacidad, seguridad, custodia pactada ni derechos inderogables, y no establecen un límite de responsabilidad de cero por el carácter gratuito del servicio.",
    ],
  },
  {
    id: "claims",
    title: "11. Reclamaciones",
    content: [
      "Cada parte informará de reclamaciones relacionadas con el servicio y colaborará de forma razonable en su gestión. La clínica responde por la legalidad de sus decisiones clínicas y la información que incorpora; el Operador responde por sus actuaciones. No se impone al paciente ni a la clínica una indemnización automática por conductas imputables al Operador.",
    ],
  },
  {
    id: "termination",
    title: "12. Suspensión, cierre y datos",
    content: [
      "Puede restringirse el acceso en forma proporcionada cuando sea necesario para contener abuso, un riesgo de seguridad o un incumplimiento material. Se notificará cuando sea posible. La suspensión no debe utilizarse para impedir derechos sobre datos o destruir el único expediente clínico.",
      "Para cerrar una cuenta escribe a legal@patientnova.net. Las partes coordinarán exportación utilizable, custodia que corresponda, devolución y eliminación según el acuerdo y la ley. El cierre no produce por sí solo borrado completo ni autoriza conservación indefinida.",
    ],
  },
  {
    id: "law",
    title: "13. Cambios, ley y controversias",
    content: [
      "Los cambios materiales se comunicarán antes de su aplicación y requerirán la aceptación o autorización que corresponda. Publicar una versión nueva no legitima un tratamiento incompatible.",
      "La relación se somete a la ley colombiana. Las controversias se tramitan ante las autoridades y jueces competentes de la República de Colombia; no se limitan competencias de protección de datos o consumo. La invalidez de una cláusula no elimina las restantes cuando puedan subsistir.",
    ],
  },
  {
    id: "contact",
    title: "14. Contacto",
    content: [
      "Juan Manuel Gallego, Tv. 5 #75D-42, apto. 619, Medellín (Antioquia), Colombia; teléfono +57 304 487 3415.",
      "Asuntos del servicio y cierre: legal@patientnova.net. Privacidad y derechos: privacidad@patientnova.net. El acuerdo de tratamiento identifica además el contacto de cada clínica para instrucciones, incidentes y solicitudes.",
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <>
      <main className="legal-page">
        <div className="legal-container">
          <header className="legal-header">
            <h1 className="legal-title">Términos para profesionales y entidades</h1>
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
