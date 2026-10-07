import Link from "next/link";

export const metadata = {
  title: "Política de Tratamiento de Datos | Patient Nova",
  description: "Cómo Patient Nova trata datos personales de profesionales, clínicas y pacientes conforme a la Ley 1581 de 2012.",
};

// Keep this as a fixed revision date. It must change when this document changes.
const lastUpdated = "7 de octubre de 2026";

const sections = [
  {
    id: "scope-and-roles",
    title: "1. Responsable, encargado y marco legal",
    content: [
      "Esta Política de Tratamiento de Datos Personales y Privacidad describe cómo Patient Nova trata datos personales de acuerdo con la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y las demás normas que los complementen, bajo la vigilancia de la Superintendencia de Industria y Comercio (SIC).",
      "Respecto de los datos de las cuentas de profesionales y clínicas que usan la Plataforma, Patient Nova actúa como Responsable del tratamiento. Respecto de los datos de pacientes que un profesional o clínica registra o recibe a través de la Plataforma (incluido el portal de reservas para pacientes), el profesional o la clínica es el Responsable y Patient Nova actúa como Encargado, tratando los datos únicamente según sus instrucciones y para prestar el Servicio.",
      "Responsable de Patient Nova: Juan Manuel Gallego, 402-1595 rue Lalemant, Sherbrooke, Canadá. Correo para datos personales: privacidad@patientnova.net. El número de identificación tributaria y, si corresponde, el representante o domicilio en Colombia se publicarán en esta sección antes del lanzamiento público del portal de pacientes.",
      "Esta Política no sustituye la información y la autorización que cada profesional o clínica debe dar a sus propios pacientes.",
    ],
  },
  {
    id: "data-collection",
    title: "2. Datos que tratamos",
    content: [
      "Cuentas de profesionales y clínicas: correo electrónico, contraseña almacenada como hash, nombre, apellidos, nombre visible, cargo, teléfono, número de WhatsApp, zona horaria, rol, estado de la cuenta, imágenes o logotipos que se suban y, si el usuario decide introducirlos, datos bancarios e identificación nacional (algunos se cifran a nivel de aplicación).",
      "Pacientes: nombre, apellidos, correo electrónico, teléfonos, canal de recordatorio preferido, notas, estado y tipo de cita, citas, recordatorios y su estado de entrega.",
      "Portal de reservas para pacientes: correo electrónico verificado mediante un código de un solo uso, nombre, apellidos, teléfono (opcional), la cita solicitada y la aceptación de esta Política (fecha, versión del texto, dirección IP y agente de usuario como evidencia de la autorización).",
      "Datos clínicos y documentos cargados por el profesional: historia clínica, motivo de consulta, información familiar, notas de evolución, identificación, sexo, fecha y lugar de nacimiento, documentos de consentimiento y otros documentos. Son datos sensibles (ver sección 3).",
      "Datos técnicos y de seguridad: dirección IP, fecha y hora de acceso, intentos fallidos y bloqueos, identificadores de usuario, método, ruta y estado de las solicitudes, y registros de auditoría de las acciones realizadas. Por defecto no registramos cadenas de consulta ni el contenido de las solicitudes, y los registros técnicos enmascaran correos, teléfonos y otros datos personales.",
      "Preferencias locales: el portal guarda la preferencia de tema claro u oscuro en el navegador. No usamos esa preferencia para publicidad.",
    ],
  },
  {
    id: "sensitive-data",
    title: "3. Datos sensibles (salud)",
    content: [
      "La información sobre la salud de una persona y los datos de historia clínica son datos sensibles. Su tratamiento requiere autorización previa, expresa e informada del titular, salvo las excepciones previstas en la ley, y ninguna actividad ni servicio puede condicionarse a que el titular responda preguntas sobre datos sensibles.",
      "Al reservar una cita en el portal, el titular acepta expresamente esta Política mediante una casilla propia que no está premarcada. Los datos de salud se tratan únicamente para las finalidades de la sección 4, y tanto los campos clínicos como los datos de identificación y contacto del paciente se almacenan cifrados a nivel de aplicación.",
    ],
  },
  {
    id: "purposes",
    title: "4. Finalidades del tratamiento",
    content: [
      "Para pacientes: permitir que el profesional gestione agenda, citas, recordatorios, historia clínica y documentos; enviar por correo, SMS o WhatsApp confirmaciones, recordatorios y avisos de cambios de la cita; verificar la titularidad del correo electrónico con un código de un solo uso; y atender solicitudes del titular.",
      "Para profesionales y clínicas: crear y administrar cuentas, autenticar usuarios, aplicar roles y permisos, prestar soporte, facturar si aplica y operar el Servicio.",
      "Para ambos: prevenir abusos, investigar incidentes y mantener la seguridad; cumplir obligaciones legales y atender requerimientos de autoridades; y conservar la evidencia necesaria para ejercer o defender derechos.",
      "No vendemos datos personales, no los usamos para publicidad ni para perfilamiento comercial y no incorporamos herramientas de analítica o publicidad de terceros. Si esto cambia, actualizaremos esta Política y pediremos las autorizaciones que correspondan.",
    ],
  },
  {
    id: "authorization",
    title: "5. Autorización y su revocatoria",
    content: [
      "Tratamos los datos con la autorización previa, expresa e informada del titular, que puede otorgarse por escrito, de forma oral o mediante conductas inequívocas, incluida la casilla de aceptación del portal. Conservamos prueba de la autorización (fecha, versión del texto, dirección IP y agente de usuario).",
      "El titular puede revocar la autorización o solicitar la supresión de sus datos en cualquier momento, siempre que no exista un deber legal o contractual de conservarlos (por ejemplo, la historia clínica). Para ello puede usar el procedimiento de la sección 7.",
    ],
  },
  {
    id: "rights",
    title: "6. Derechos del titular",
    content: [
      "Conforme al artículo 8 de la Ley 1581 de 2012, el titular tiene derecho a: conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización otorgada; ser informado sobre el uso que se ha dado a sus datos; presentar quejas ante la SIC por infracciones a la ley; revocar la autorización y solicitar la supresión del dato cuando no se respeten los principios, derechos y garantías legales; y acceder de forma gratuita a sus datos personales.",
      "Si eres paciente, puedes dirigir tu solicitud al profesional o clínica que registró tus datos o directamente a privacidad@patientnova.net. Si no somos competentes para resolverla, la trasladaremos a quien corresponda dentro de los dos (2) días hábiles siguientes y te informaremos.",
    ],
  },
  {
    id: "procedure",
    title: "7. Consultas y reclamos",
    content: [
      "Área responsable de recibir consultas y reclamos: Privacidad de Patient Nova, privacidad@patientnova.net. Para atender una solicitud podemos pedir información razonable que acredite la identidad del titular, de su causahabiente o de su representante.",
      "Consultas: responderemos en máximo diez (10) días hábiles contados desde la recepción. Si no es posible, te informaremos los motivos y la nueva fecha, que no superará cinco (5) días hábiles adicionales.",
      "Reclamos (corrección, actualización, supresión o presunto incumplimiento): deben incluir identificación del titular, descripción de los hechos, dirección o correo de respuesta y los documentos que quieras hacer valer. Si está incompleto, te pediremos subsanarlo dentro de los cinco (5) días siguientes. Responderemos en máximo quince (15) días hábiles, prorrogables por ocho (8) días hábiles más con aviso de los motivos. Mientras se resuelve, el dato se marcará como «reclamo en trámite».",
      "El titular solo puede acudir a la SIC después de agotar este trámite ante el Responsable o Encargado.",
    ],
  },
  {
    id: "sharing",
    title: "8. Encargados, transmisión y transferencias internacionales",
    content: [
      "Para operar el Servicio transmitimos los datos estrictamente necesarios a encargados que los tratan en nuestro nombre: Twilio (SMS, WhatsApp y estados de entrega), Brevo (correo electrónico transaccional), Google (Google Meet, cuando el profesional lo activa) y los proveedores de alojamiento y base de datos que el operador configure. Si se activa el seguimiento de errores, se usará Sentry con la recolección de datos personales desactivada y los eventos depurados antes de enviarse.",
      "Algunos de estos proveedores pueden tratar datos fuera de Colombia. Las transmisiones y transferencias internacionales se realizan con las salvaguardas del artículo 26 de la Ley 1581 de 2012 y de los artículos aplicables del Decreto 1377 de 2013 (países con nivel adecuado, autorización del titular o contratos de transmisión con deberes equivalentes de protección). No se declara una región única de alojamiento.",
      "Solo divulgamos datos a terceros distintos cuando una autoridad lo exija válidamente o para proteger derechos y seguridad, y en reorganizaciones empresariales con las garantías legales. Los proveedores quedan sujetos además a sus propias condiciones.",
    ],
  },
  {
    id: "public-documents",
    title: "9. Documentos y enlaces de descarga",
    content: [
      "La Plataforma permite que una cuenta cargue documentos de consentimiento y otros documentos. Algunos enlaces de descarga no requieren iniciar sesión: cualquier persona que obtenga un enlace válido podría acceder al documento. No compartas esos enlaces públicamente ni cargues información sensible en un documento enlazable si no necesitas hacerlo.",
    ],
  },
  {
    id: "retention",
    title: "10. Conservación, vigencia de las bases de datos y eliminación",
    content: [
      "Conservamos los datos mientras la cuenta esté activa, mientras sean necesarios para las finalidades descritas o durante el tiempo que exija la ley o un contrato. Las historias clínicas se rigen por la Resolución 1995 de 1999 del Ministerio de Salud y las normas que la modifiquen, que fijan plazos mínimos de conservación que prevalecen sobre una solicitud de supresión.",
      "Algunas entidades se eliminan de forma lógica y pueden restaurarse por un tiempo. Las copias de seguridad y los registros de auditoría se conservan durante el tiempo operativo o legal necesario. La vigencia de las bases de datos es la de la prestación del Servicio y el tiempo posterior que impongan las obligaciones legales.",
      "Para cerrar una cuenta o suprimir datos, escribe a privacidad@patientnova.net. La clínica debe exportar la información que necesite y cumplir sus propias obligaciones de conservación antes de pedir el cierre.",
    ],
  },
  {
    id: "security",
    title: "11. Seguridad e incidentes",
    content: [
      "Aplicamos medidas técnicas, humanas y administrativas razonables: contraseñas con hash, tokens de sesión de corta duración con audiencia y emisor verificados, cookies de autenticación HttpOnly y Secure, control de acceso por roles, aislamiento de datos por cuenta, validación de entradas, limitación de solicitudes compartida entre instancias, cabeceras de seguridad, bloqueo tras intentos fallidos, registros de auditoría y cifrado a nivel de aplicación de los campos clínicos, de notas, de los datos de identificación y contacto de los pacientes (nombre, apellidos, correo electrónico y teléfonos, también en los recordatorios) y de ciertos datos bancarios.",
      "El cifrado en tránsito y en reposo de la base de datos y de las copias de seguridad depende también del proveedor de infraestructura. Ningún sistema es completamente seguro.",
      "Si ocurre un incidente que afecte datos personales, lo investigaremos, tomaremos medidas de contención e informaremos a la SIC y a los titulares afectados en los casos y plazos que exija la ley. Si detectas un acceso no autorizado, escríbenos de inmediato a privacidad@patientnova.net.",
    ],
  },
  {
    id: "cookies",
    title: "12. Cookies y almacenamiento local",
    content: [
      "El portal profesional usa dos cookies propias necesarias para la autenticación (acceso y renovación), HttpOnly y Secure. El portal de reservas para pacientes usa una cookie de sesión propia (portal_session), HttpOnly, Secure y SameSite=Lax, que solo vale para verificar tu correo durante la reserva y expira en pocas horas.",
      "El portal guarda la preferencia de tema en localStorage. No usamos cookies de terceros, publicidad ni seguimiento entre sitios.",
    ],
  },
  {
    id: "changes",
    title: "13. Cambios y vigencia",
    content: [
      "Esta Política rige desde la fecha de «Última actualización». Podemos modificarla por cambios legales, técnicos o del Servicio; publicaremos la nueva versión en esta página y, cuando el cambio sea sustancial, pediremos nuevamente la autorización al titular por el medio que corresponda (por ejemplo, la próxima vez que reserve una cita).",
    ],
  },
  {
    id: "contact",
    title: "14. Contacto",
    content: [
      "Juan Manuel Gallego. 402-1595 rue Lalemant, Sherbrooke, Canadá.",
      "Datos personales, consultas y reclamos: privacidad@patientnova.net",
      "Asuntos legales: legal@patientnova.net",
      "Estos buzones deben estar activos y supervisados.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <main className="legal-page">
        <div className="legal-container">
          <header className="legal-header">
            <h1 className="legal-title">Política de Tratamiento de Datos Personales y Privacidad</h1>
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
