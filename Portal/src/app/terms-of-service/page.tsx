import Link from "next/link";

export const metadata = {
  title: "Términos de Servicio | Patient Nova",
  description: "Términos que regulan el uso de Patient Nova por profesionales y equipos de salud.",
};

// Keep this as a fixed revision date. It must change when this document changes.
const lastUpdated = "12 de septiembre de 2026";

const sections = [
  {
    id: "acceptance",
    title: "1. Aceptación y alcance",
    content: [
      "Estos Términos de Servicio (los «Términos») regulan el acceso y uso de Patient Nova (la «Plataforma» o el «Servicio»). Al acceder o utilizar el Servicio, aceptas estos Términos y la Política de Privacidad. Si actúas en nombre de una clínica, consulta o entidad, declaras que tienes autorización para vincularla.",
      "El Servicio está diseñado para profesionales y equipos de salud. No es un servicio para pacientes, no sustituye el criterio profesional, no ofrece consejo médico y no debe utilizarse para emergencias ni para decisiones clínicas sin la supervisión del profesional responsable.",
      "Si no aceptas estos Términos, no debes utilizar el Servicio.",
    ],
  },
  {
    id: "service-description",
    title: "2. Descripción y límites del Servicio",
    content: [
      "Patient Nova ofrece herramientas administrativas para gestionar usuarios de una clínica, pacientes, citas, calendario, bloqueos de agenda, tipos de cita, historiales y documentos clínicos, recordatorios por SMS o WhatsApp, reuniones mediante Google Meet y registros de actividad.",
      "Las funcionalidades pueden cambiar, quedar temporalmente no disponibles o depender de servicios externos. Salvo que exista un acuerdo escrito distinto, el Servicio se presta sin un nivel de servicio garantizado y no prometemos que sea ininterrumpido, completamente seguro o libre de errores.",
      "La entrega de SMS y WhatsApp depende de Twilio, operadores de telecomunicaciones y del dispositivo del destinatario. No garantizamos la entrega, el momento de entrega ni la disponibilidad de esos servicios externos.",
    ],
  },
  {
    id: "accounts",
    title: "3. Cuentas y acceso",
    content: [
      "Debes proporcionar información exacta y mantenerla actualizada. Solo pueden utilizar el Servicio personas con capacidad legal suficiente y autorización de la clínica o entidad correspondiente.",
      "Eres responsable de proteger tus credenciales, de no compartirlas y de todas las actividades realizadas desde tu cuenta. Debes avisarnos sin demora si sospechas de un acceso no autorizado.",
      "Los administradores de la cuenta pueden asignar roles y permisos a otros usuarios. La clínica es responsable de conceder únicamente el acceso necesario y de retirar el acceso cuando una persona deje de estar autorizada.",
      "Patient Nova no realiza actualmente una verificación general de identidad, colegiatura o licencia profesional. No presentes la existencia de una cuenta como certificación de una persona o entidad.",
    ],
  },
  {
    id: "customer-data",
    title: "4. Datos que introduces en el Servicio",
    content: [
      "Conservas los derechos que tengas sobre los datos que introduces, incluidos los datos de pacientes, historiales, citas, documentos, mensajes y configuraciones. Nos concedes el permiso limitado necesario para alojar, organizar, respaldar, procesar y transmitir esos datos únicamente para operar, proteger y mantener el Servicio.",
      "Cuando la legislación de protección de datos distingue entre responsable y encargado, la clínica o entidad que decide para qué y cómo se tratan los datos de sus pacientes normalmente actúa como responsable, y Patient Nova actúa como proveedor o encargado en la medida aplicable. Las partes deben formalizar los acuerdos adicionales que exija la ley antes de cargar datos regulados.",
      "Tú eres responsable de tener una base legal para introducir datos de pacientes, informar a las personas afectadas, obtener los consentimientos necesarios, respetar sus solicitudes y utilizar los canales de mensajería conforme a la ley. Patient Nova no proporciona asesoría legal sobre esas obligaciones.",
    ],
  },
  {
    id: "third-parties",
    title: "5. Servicios de terceros y comunicaciones",
    content: [
      "El Servicio puede utilizar proveedores externos, entre ellos Twilio para SMS, WhatsApp y estados de entrega, Google para determinadas funciones de Google Meet, y proveedores de alojamiento y base de datos. El uso de esas funciones puede implicar que los datos necesarios se transmitan a dichos proveedores conforme a sus propias condiciones y políticas.",
      "Antes de enviar un mensaje, debes asegurarte de que el destinatario ha proporcionado el número correcto y de que tienes autorización, consentimiento o cualquier otra base legal necesaria. No utilices Patient Nova para spam, mensajes engañosos o comunicaciones no solicitadas.",
      "Debes atender las solicitudes de no recibir comunicaciones y mantener tus propios procedimientos de consentimiento, oposición y exclusión. La Plataforma no garantiza que un canal externo ofrezca una función de baja para cada tipo de mensaje.",
    ],
  },
  {
    id: "acceptable-use",
    title: "6. Uso aceptable",
    content: [
      "No debes:",
      "• utilizar el Servicio para fines ilegales, fraudulentos, discriminatorios o perjudiciales;",
      "• acceder o intentar acceder a cuentas, datos, documentos o sistemas ajenos;",
      "• introducir malware, realizar ingeniería inversa, escanear, explotar vulnerabilidades, hacer scraping abusivo, realizar fuerza bruta o provocar una denegación de servicio;",
      "• enviar comunicaciones masivas no solicitadas o incumplir las reglas de Twilio, WhatsApp, Google u otros proveedores;",
      "• suplantar a una persona o entidad, falsear una autorización o cargar datos sin una base legal; ni",
      "• exportar, divulgar o utilizar datos de pacientes fuera de lo permitido por la ley, tus instrucciones internas y los derechos de las personas afectadas.",
      "Podemos investigar y restringir actividades que razonablemente consideremos abusivas, ilegales o que pongan en riesgo a usuarios, pacientes, proveedores o al Servicio.",
    ],
  },
  {
    id: "intellectual-property",
    title: "7. Propiedad intelectual",
    content: [
      "Patient Nova, incluyendo su software, diseño, marca, logotipos, documentación y componentes que no sean datos del cliente, pertenece al proveedor del Servicio o a sus licenciantes. Estos Términos solo te conceden un derecho limitado, no exclusivo, no transferible y revocable para utilizar el Servicio durante la vigencia de tu acceso.",
      "No puedes copiar, vender, sublicenciar, distribuir ni crear obras derivadas del Servicio, salvo que una ley imperativa lo permita o que exista autorización escrita.",
    ],
  },
  {
    id: "fees",
    title: "8. Precios y pagos",
    content: [
      "La versión actual de la Plataforma no implementa planes de suscripción, renovación automática ni cobros de la cuenta dentro del Servicio. Los importes, precios y estados de pago que aparecen en una cita son datos de la clínica y no constituyen una factura ni un cobro de Patient Nova.",
      "Si se ofrecen planes de pago en el futuro, sus precios, impuestos, renovación, cancelación y reembolsos deberán comunicarse antes de contratarse y podrán estar sujetos a condiciones comerciales adicionales. Nada de esta sección limita los derechos que la ley conceda a consumidores o clientes.",
    ],
  },
  {
    id: "suspension",
    title: "9. Suspensión y terminación",
    content: [
      "Puedes dejar de utilizar el Servicio y solicitar el cierre de tu cuenta escribiendo a un contacto de soporte o legal. No existe actualmente una promesa de eliminación instantánea ni un periodo de gracia automático desde la interfaz.",
      "Podemos suspender o terminar el acceso cuando sea razonablemente necesario para evitar fraude, abuso, riesgos de seguridad, incumplimientos legales o daños al Servicio, o cuando incumplas materialmente estos Términos. Cuando sea razonable y legalmente posible, te avisaremos y te daremos la oportunidad de corregir el incumplimiento.",
      "La terminación no elimina automáticamente todos los datos. La conservación, eliminación, copias de seguridad y obligaciones legales se rigen por la Política de Privacidad y por cualquier acuerdo aplicable. Debes exportar los datos que necesites antes de cerrar la cuenta.",
    ],
  },
  {
    id: "disclaimer",
    title: "10. Exenciones y responsabilidad",
    content: [
      "EN LA MEDIDA MÁXIMA PERMITIDA POR LA LEY, EL SERVICIO SE OFRECE «TAL CUAL» Y SEGÚN DISPONIBILIDAD. EXCLUIMOS LAS GARANTÍAS IMPLÍCITAS QUE LA LEY PERMITA EXCLUIR, INCLUIDAS IDONEIDAD PARA UN FIN PARTICULAR, COMERCIABILIDAD Y NO INFRACCIÓN.",
      "Patient Nova no garantiza la exactitud de los datos introducidos por los usuarios, la continuidad del Servicio, la entrega de mensajes, la disponibilidad de servicios externos ni que el Servicio satisfaga obligaciones profesionales, sanitarias, de conservación, privacidad o seguridad específicas de tu jurisdicción.",
      "No somos responsables de decisiones clínicas, de la relación con tus pacientes, de las comunicaciones que envíes, de la legalidad de los datos que introduzcas ni de fallos de proveedores externos. En la medida permitida por la ley, no responderemos por daños indirectos, incidentales, especiales o consecuentes.",
      "Cuando la ley permita limitar la responsabilidad, la responsabilidad total agregada del proveedor por reclamaciones relacionadas con el Servicio se limitará a las cantidades que hayas pagado por el Servicio durante los doce meses anteriores al hecho que originó la reclamación. Esta limitación no se aplica a responsabilidades que no puedan limitarse legalmente.",
    ],
  },
  {
    id: "indemnification",
    title: "11. Reclamaciones de terceros",
    content: [
      "En la medida permitida por la ley, aceptas indemnizar al proveedor del Servicio por reclamaciones de terceros que resulten directamente de tu uso ilícito del Servicio, del contenido que introduzcas, de mensajes enviados por tu cuenta o de tu incumplimiento de estos Términos. Esta obligación no se aplica cuando la reclamación se deba exclusivamente a una conducta del proveedor del Servicio.",
    ],
  },
  {
    id: "changes",
    title: "12. Cambios en estos Términos",
    content: [
      "Podemos modificar estos Términos para reflejar cambios legales, técnicos o del Servicio. Publicaremos la versión revisada junto con su fecha de actualización. Si el cambio es material, proporcionaremos un aviso adicional cuando la ley lo exija. El uso continuado del Servicio después de la entrada en vigor de los cambios significa que aceptas la versión revisada.",
    ],
  },
  {
    id: "governing-law",
    title: "13. Ley aplicable y jurisdicción",
    content: [
      "La ley aplicable y los tribunales competentes deben completarse con la identidad legal y la jurisdicción real del proveedor antes de publicar estos Términos como versión definitiva. Hasta entonces, se aplicarán las normas imperativas que correspondan y nada de estos Términos limita los derechos que no puedan excluirse por ley.",
      "Si una disposición resulta inválida o inaplicable, se modificará en la medida mínima necesaria y las demás disposiciones continuarán vigentes.",
    ],
  },
  {
    id: "contact",
    title: "14. Contacto",
    content: [
      "Juan Manuel Gallego. 402-1595 rue Lalemant, Sherbrooke, Canada.",
      "Contacto legal: legal@patientnova.net",
      "Contacto de privacidad: privacidad@patientnova.net",
      "Para preguntas sobre estos Términos, solicitudes de cierre o reclamaciones, utiliza el contacto legal. Estos buzones deben estar activos y supervisados antes de publicar esta página.",
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <>
      <main className="legal-page">
        <div className="legal-container">
          <header className="legal-header">
            <h1 className="legal-title">Términos de Servicio</h1>
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
