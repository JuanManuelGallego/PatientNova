import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad | Patient Nova",
  description: "Política de tratamiento de datos personales de Patient Nova para cuentas, clínicas y pacientes.",
};

// Keep this as a fixed revision date. It must change when this document changes.
const lastUpdated = "19 de octubre de 2026";

const sections = [
  {
    id: "scope-and-roles",
    title: "1. Responsable, encargado y alcance",
    content: [
      "Patient Nova es el nombre comercial del servicio prestado por Juan Manuel Gallego, persona natural, con domicilio en 402-1595 rue Lalemant, Sherbrooke (Québec), Canadá, teléfono +57 304 487 3415 y correo electrónico privacidad@patientnova.net (el «Proveedor»). Esta Política de Tratamiento de Datos Personales describe cómo se trata la información en el portal de gestión para profesionales y equipos de salud y, cuando una clínica lo habilite, en el portal de pacientes.",
      "Esta Política se rige por la Ley Estatutaria 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto Único 1074 de 2015) y las demás normas colombianas sobre protección de datos personales, sin perjuicio de las normas imperativas de otras jurisdicciones que resulten aplicables.",
      "El Proveedor actúa como responsable del tratamiento de los datos de las cuentas de usuarios profesionales y de los datos técnicos y de seguridad del Servicio. Respecto de los datos de pacientes, la clínica, profesional o entidad que utiliza el Servicio es la responsable del tratamiento, y el Proveedor actúa como encargado, tratándolos por cuenta de ella y siguiendo sus instrucciones.",
      "Si eres paciente, la clínica o profesional que te atiende es quien decide para qué se usan tus datos; dirige a ella tus solicitudes en primer lugar. Esta Política no sustituye la información ni la autorización que la clínica deba obtener de sus pacientes.",
    ],
  },
  {
    id: "data-collection",
    title: "2. Datos que podemos tratar",
    content: [
      "Datos de cuenta y perfil: correo electrónico, contraseña almacenada como hash, nombre, apellidos, nombre visible, cargo, teléfono, número de WhatsApp, zona horaria, rol, estado de la cuenta y avatares o logotipos que subas.",
      "Datos financieros o identificativos que el usuario decida introducir: nombre del banco, número de cuenta, clave bancaria e identificación nacional. Algunos de estos campos se cifran a nivel de aplicación cuando la clave de cifrado de producción está configurada correctamente.",
      "Datos de pacientes: nombre, apellidos, correo electrónico, teléfonos, canal preferido para recordatorios, notas, estado, tipo de cita y cualquier otro dato que la clínica introduzca.",
      "Datos clínicos y documentos: identificación nacional, sexo, fecha y lugar de nacimiento, motivo de consulta, historia clínica, información familiar, notas de evolución, relaciones familiares, documentos médicos y documentos de consentimiento que se carguen en la Plataforma. Los datos relativos a la salud son datos sensibles según el artículo 5 de la Ley 1581 de 2012.",
      "Datos operativos y de comunicaciones: citas, horarios, zona horaria, ubicación, precio, moneda, estado de pago, notas, enlaces de Google Meet, recordatorios, destinatarios, contenido, plantillas, variables, estados de entrega (entregado, rebotado, bloqueado o fallido), identificadores de mensajes y errores de proveedores, tanto de SMS y WhatsApp como de correo electrónico.",
      "Portal de pacientes, cuando la clínica lo habilite: el correo electrónico con el que el paciente solicita acceso, un código de un solo uso (almacenado solo como hash, con expiración breve y un número máximo de intentos), la sesión del portal, las citas que el paciente consulte, reserve o cancele, y registros de auditoría de esas acciones con un identificador seudonimizado del paciente.",
      "Datos de seguridad y uso: dirección IP, fecha y hora de acceso, intentos fallidos, bloqueos, rutas solicitadas, identificadores de usuario, estado y duración de las solicitudes y acciones registradas. Los contadores de limitación de solicitudes por dirección IP se mantienen solo en memoria y no se almacenan de forma permanente. No afirmamos recopilar un perfil completo del dispositivo o del navegador si no se obtiene de otra forma.",
      "Verificación anti-bots: en los formularios públicos (por ejemplo, solicitar un código de acceso o reservar una cita sin iniciar sesión), el navegador ejecuta una comprobación de Cloudflare Turnstile que puede tratar la dirección IP y señales técnicas del navegador y de la interacción para distinguir personas de programas automatizados. Patient Nova solo recibe el resultado de la verificación; no recibe ni conserva esas señales.",
      "Preferencias locales: el portal guarda la preferencia de tema claro u oscuro en el almacenamiento local del navegador. No utilizamos esa preferencia para publicidad.",
    ],
  },
  {
    id: "purposes",
    title: "3. Finalidades del tratamiento",
    content: [
      "Crear y administrar cuentas, autenticar usuarios, aplicar roles y permisos, gestionar pacientes, citas, historiales, documentos, recordatorios y configuraciones, y proporcionar soporte.",
      "Enviar, por instrucción de la clínica, recordatorios y comunicaciones por SMS, WhatsApp o correo electrónico, y registrar su estado de entrega.",
      "Cuando el portal de pacientes esté habilitado: enviar al paciente códigos de acceso por correo electrónico, mantener su sesión y permitirle consultar, reservar o cancelar citas con la clínica.",
      "Prevenir abusos y fraude, verificar que los formularios públicos los usan personas, limitar solicitudes, investigar incidentes, mantener registros de auditoría y operar y proteger el Servicio.",
      "Cumplir obligaciones legales, atender requerimientos válidos de autoridades, hacer valer nuestros acuerdos y mantener los registros necesarios para resolver reclamaciones.",
      "No usamos datos de la Plataforma para publicidad conductual ni incorporamos herramientas de analítica de terceros. La verificación anti-bots se utiliza únicamente para proteger formularios públicos frente a abusos. Si alguna finalidad cambia, actualizaremos esta Política y solicitaremos las autorizaciones necesarias.",
    ],
  },
  {
    id: "legal-bases",
    title: "4. Autorización y responsabilidad de la clínica",
    content: [
      "El tratamiento de datos personales requiere la autorización previa, expresa e informada de su titular, salvo en los casos exceptuados por el artículo 10 de la Ley 1581 de 2012. El Proveedor trata los datos de las cuentas de usuarios con base en la autorización otorgada al registrarse y en la relación contractual con la clínica.",
      "Como responsable de los datos de sus pacientes, la clínica debe obtener y conservar prueba de su autorización, informarles las finalidades del tratamiento y sus derechos y, para datos sensibles como los de salud, informarles que no están obligados a autorizar su tratamiento y obtener su autorización explícita. Patient Nova no decide el tratamiento clínico de un paciente ni sustituye las obligaciones de la clínica.",
      "Los datos de niños, niñas y adolescentes solo pueden tratarse respetando sus derechos prevalentes y con la autorización de su representante legal, conforme al artículo 7 de la Ley 1581 de 2012. La clínica es responsable de obtener esa autorización.",
      "No cargues datos de salud, identificativos o documentos si no tienes autorización para hacerlo o si no se han acordado las garantías contractuales, técnicas y organizativas exigibles.",
    ],
  },
  {
    id: "sharing",
    title: "5. Encargados, transmisiones y transferencias",
    content: [
      "Compartimos los datos necesarios con proveedores que actúan como encargados o subencargados para operar el Servicio: Twilio, para SMS, WhatsApp y estados de entrega; Brevo, para el envío de correos electrónicos (recordatorios, códigos de acceso y avisos) y sus eventos de entrega; Google, para funciones de Google Meet; Cloudflare, para la verificación anti-bots (Turnstile) en formularios públicos; Sentry, para el registro de errores técnicos del servidor y del navegador (tipo de error, traza de código, versión y entorno), configurado para no enviar contenido de solicitudes, cookies, encabezados ni datos de usuario y para enmascarar correos electrónicos y teléfonos; y proveedores de alojamiento, base de datos, registro, seguridad y soporte que el operador configure. Sus ubicaciones, subencargados y condiciones pueden cambiar.",
      "Varios de estos proveedores, y el propio Proveedor, que se encuentra en Canadá, pueden tratar los datos fuera de Colombia, por ejemplo en Estados Unidos, Canadá o la Unión Europea. Estas transmisiones y transferencias internacionales se realizan conforme al artículo 26 de la Ley 1581 de 2012 y a las normas que lo reglamentan, mediante contratos u otros mecanismos que garanticen un nivel adecuado de protección.",
      "Podemos divulgar información cuando sea necesario para cumplir una obligación legal, responder a una orden válida de autoridad competente, proteger derechos y seguridad o investigar fraude. También podemos transferir información como parte de una reorganización, adquisición o venta, sujeto a las garantías y avisos que exija la ley.",
      "No vendemos datos personales. Los datos enviados a Twilio, Brevo, Google, Cloudflare, Sentry u otros proveedores quedan sujetos también a las políticas y condiciones de esos proveedores.",
    ],
  },
  {
    id: "public-documents",
    title: "6. Documentos y enlaces de descarga",
    content: [
      "La Plataforma permite que una cuenta cargue documentos de consentimiento y otros documentos clínicos. Los usuarios deben cargar únicamente la información necesaria y verificar cuidadosamente quién puede acceder a cualquier enlace que compartan.",
      "Algunas funciones de descarga de documentos pueden utilizar enlaces que no requieren iniciar sesión. Cualquier persona que obtenga un enlace de descarga válido podría acceder al documento correspondiente. No compartas esos enlaces públicamente ni cargues información sensible hasta confirmar que la configuración de acceso satisface tus obligaciones.",
    ],
  },
  {
    id: "retention",
    title: "7. Conservación y eliminación",
    content: [
      "Conservamos los datos mientras la cuenta y el Servicio estén activos, mientras sean necesarios para las finalidades descritas, o durante el tiempo que exija un contrato, una obligación legal, la seguridad o la resolución de reclamaciones. La conservación de historias clínicas depende de la clínica y de la normativa sanitaria aplicable, como la Resolución 839 de 2017; la clínica es responsable de cumplir esos plazos.",
      "Los códigos de acceso del portal de pacientes expiran pocos minutos después de emitirse y las sesiones del portal tienen una duración limitada (actualmente, dos horas).",
      "Algunas entidades se eliminan mediante borrado lógico: pueden dejar de aparecer en la interfaz, pero permanecer en la base de datos y ser restaurables durante un periodo no definido públicamente. Las copias de seguridad, registros técnicos y registros de auditoría pueden conservarse durante el tiempo operativo o legal necesario.",
      "No existe actualmente una promesa técnica de anonimización o borrado completo en un plazo fijo. Para solicitar el cierre de una cuenta o la supresión de datos, escribe a privacidad@patientnova.net. Atenderemos la solicitud conforme a la sección 10; la supresión no procede cuando exista un deber legal o contractual de conservar los datos.",
      "La clínica debe exportar la información que necesite y cumplir sus propias obligaciones de conservación antes de solicitar el cierre.",
    ],
  },
  {
    id: "security",
    title: "8. Seguridad",
    content: [
      "Aplicamos controles de seguridad que incluyen contraseñas con hash, tokens de sesión con expiración, cookies de autenticación HttpOnly y Secure, protección contra falsificación de solicitudes (CSRF), control de acceso por roles, aislamiento de datos por cuenta, validación de entradas, limitación de solicitudes, verificación anti-bots en formularios públicos, códigos de acceso de un solo uso con número máximo de intentos, cabeceras de seguridad, bloqueo tras intentos fallidos y registros de auditoría.",
      "En producción, la aplicación requiere una clave para cifrar determinados campos sensibles, incluidos algunos datos bancarios, partes de historiales y los datos de identificación y contacto de los pacientes (nombre, apellidos, correo electrónico y teléfonos, también en los recordatorios). Esto no significa que todos los campos, archivos, copias de seguridad o sistemas de los proveedores estén cifrados con el mismo mecanismo.",
      "El cifrado de la conexión y el cifrado de la base de datos en reposo dependen también de la infraestructura de despliegue y del proveedor de alojamiento. No afirmamos que ninguna transmisión o sistema sea completamente seguro.",
      "Si detectas un acceso no autorizado o un incidente relacionado con tus datos, notifícalo inmediatamente en privacidad@patientnova.net. Cuando corresponda, informaremos los incidentes de seguridad a la clínica responsable y a la Superintendencia de Industria y Comercio.",
    ],
  },
  {
    id: "cookies",
    title: "9. Cookies y almacenamiento local",
    content: [
      "El portal de profesionales utiliza dos cookies propias necesarias para la autenticación: una cookie de acceso con duración corta y una cookie de renovación con duración limitada. Son HttpOnly, Secure y utilizan SameSite=None para permitir el funcionamiento entre el portal y la API configurados por el operador.",
      "Cuando el portal de pacientes esté habilitado, utiliza una única cookie propia de sesión, necesaria para mantener el acceso del paciente. Es HttpOnly y Secure, utiliza SameSite=Lax, solo se envía a las rutas del portal de pacientes y caduca con la sesión (actualmente, dos horas).",
      "En los formularios públicos con verificación anti-bots, la comprobación se carga desde Cloudflare (challenges.cloudflare.com) en un marco integrado y se rige también por las condiciones de privacidad de Cloudflare. No la utilizamos para publicidad ni para seguimiento entre sitios.",
      "El portal guarda la preferencia de tema claro u oscuro en localStorage del navegador. No utilizamos cookies de terceros para publicidad ni seguimiento entre sitios. Si añadimos cookies no necesarias o tecnologías de medición, proporcionaremos la información y el mecanismo de elección que exija la ley antes de utilizarlas.",
    ],
  },
  {
    id: "rights",
    title: "10. Derechos del titular y procedimiento",
    content: [
      "Conforme al artículo 8 de la Ley 1581 de 2012, como titular puedes: conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización otorgada; ser informado sobre el uso que se ha dado a tus datos; presentar quejas ante la Superintendencia de Industria y Comercio; revocar la autorización o solicitar la supresión de tus datos cuando no se respeten los principios, derechos y garantías legales y no exista un deber legal o contractual de conservarlos; y acceder gratuitamente a tus datos.",
      "Si eres paciente, dirige primero la solicitud a la clínica que introdujo tus datos, porque es la responsable de su tratamiento. Si la recibimos nosotros, la trasladaremos a la clínica y te informaremos de ello. Si eres usuario de Patient Nova, escribe a privacidad@patientnova.net indicando tu nombre, tu relación con la cuenta, la solicitud concreta y un medio de respuesta. Podemos pedir información razonable para verificar tu identidad o la de tu representante.",
      "Las consultas se atenderán en un máximo de diez (10) días hábiles desde su recepción, prorrogables por cinco (5) días hábiles más, y los reclamos en un máximo de quince (15) días hábiles, prorrogables por ocho (8) días hábiles más, informando en ambos casos el motivo de la demora, conforme a los artículos 14 y 15 de la Ley 1581 de 2012.",
      "Antes de presentar una queja ante la Superintendencia de Industria y Comercio debes haber agotado el trámite de consulta o reclamo ante el responsable o el encargado, según el artículo 16 de la Ley 1581 de 2012. La persona encargada de atender estas solicitudes es Juan Manuel Gallego, a través de privacidad@patientnova.net.",
    ],
  },
  {
    id: "changes",
    title: "11. Cambios y vigencia",
    content: [
      "Podemos actualizar esta Política para reflejar cambios legales, técnicos o del Servicio. Publicaremos la nueva versión en esta página con su fecha de actualización. Los cambios sustanciales, en particular los que afecten a la identidad del responsable o a las finalidades del tratamiento, se comunicarán antes de su implementación por correo electrónico o dentro de la Plataforma, y obtendremos una nueva autorización cuando la ley lo exija.",
      "Esta Política rige a partir de la fecha de actualización indicada al inicio de esta página. Las bases de datos permanecerán vigentes mientras se mantengan las finalidades descritas o exista un deber legal o contractual de conservar los datos.",
    ],
  },
  {
    id: "contact",
    title: "12. Contacto",
    content: [
      "Responsable: Juan Manuel Gallego, persona natural. 402-1595 rue Lalemant, Sherbrooke (Québec), Canadá.",
      "Teléfono: +57 304 487 3415",
      "Privacidad, consultas y reclamos: privacidad@patientnova.net",
      "Asuntos legales: legal@patientnova.net",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <main className="legal-page">
        <div className="legal-container">
          <header className="legal-header">
            <h1 className="legal-title">Política de Privacidad</h1>
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
