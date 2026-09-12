import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad | Patient Nova",
  description: "Cómo Patient Nova trata los datos de las cuentas, clínicas y pacientes.",
};

// Keep this as a fixed revision date. It must change when this document changes.
const lastUpdated = "12 de septiembre de 2026";

const sections = [
  {
    id: "scope-and-roles",
    title: "1. Alcance y responsables",
    content: [
      "Esta Política de Privacidad describe cómo Patient Nova trata la información relacionada con su portal de gestión para profesionales y equipos de salud. La Plataforma no ofrece actualmente una cuenta para pacientes; si eres paciente, normalmente debes dirigir tus solicitudes a la clínica o profesional que introdujo tus datos.",
      "Patient Nova es el nombre comercial del servicio. La razón social completa, domicilio registrado y número de identificación fiscal del proveedor deben añadirse a esta sección antes del lanzamiento público. La clínica o entidad que utiliza el Servicio puede ser el responsable del tratamiento de los datos de sus pacientes, mientras que Patient Nova puede actuar como proveedor o encargado siguiendo sus instrucciones, según la ley aplicable y el acuerdo entre las partes.",
      "Esta Política no sustituye la información que una clínica deba entregar a sus pacientes ni los acuerdos de tratamiento de datos que puedan ser obligatorios.",
    ],
  },
  {
    id: "data-collection",
    title: "2. Datos que podemos tratar",
    content: [
      "Datos de cuenta y perfil: correo electrónico, contraseña almacenada como hash, nombre, apellidos, nombre visible, cargo, teléfono, número de WhatsApp, zona horaria, rol, estado de la cuenta y avatares o logotipos que subas.",
      "Datos financieros o identificativos que el usuario decida introducir: nombre del banco, número de cuenta, clave bancaria e identificación nacional. Algunos de estos campos se cifran a nivel de aplicación cuando la clave de cifrado de producción está configurada correctamente.",
      "Datos de pacientes: nombre, apellidos, correo electrónico, teléfonos, notas, estado, tipo de cita y cualquier otro dato que la clínica introduzca.",
      "Datos clínicos y documentos: identificación nacional, sexo, fecha y lugar de nacimiento, motivo de consulta, historia clínica, información familiar, notas de evolución, relaciones familiares, documentos médicos y documentos de consentimiento que se carguen en la Plataforma. Estos datos pueden pertenecer a categorías especialmente protegidas por la ley.",
      "Datos operativos: citas, horarios, zona horaria, ubicación, precio, moneda, estado de pago, notas, enlaces de Google Meet, recordatorios, destinatarios, contenido, plantillas, variables, estados de entrega, identificadores de mensajes y errores de proveedores.",
      "Datos de seguridad y uso: dirección IP, fecha y hora de acceso, intentos fallidos, bloqueos, URL, parámetros, identificadores de usuario, estado y duración de las solicitudes, acciones registradas y, según el nivel de registro del servidor, datos enviados en el cuerpo de una solicitud. No afirmamos recopilar un perfil completo del dispositivo o del navegador si no se obtiene de otra forma.",
      "Preferencias locales: el portal guarda la preferencia de tema claro u oscuro en el almacenamiento local del navegador. No utilizamos esa preferencia para publicidad.",
    ],
  },
  {
    id: "purposes",
    title: "3. Para qué utilizamos los datos",
    content: [
      "Utilizamos los datos para crear y administrar cuentas, autenticar usuarios, aplicar roles y permisos, gestionar pacientes, citas, historiales, documentos, recordatorios y configuraciones, y proporcionar soporte.",
      "Utilizamos datos de contacto y de citas para enviar SMS o WhatsApp cuando la clínica lo solicita, y datos técnicos, de autenticación y de actividad para prevenir abusos, investigar incidentes, mantener la seguridad y operar el Servicio.",
      "También podemos tratar información para cumplir obligaciones legales, atender requerimientos válidos de autoridades, hacer valer nuestros acuerdos y mantener registros necesarios para resolver disputas.",
      "La implementación actual no usa datos de la Plataforma para publicidad conductual ni incorpora una herramienta de analítica de terceros. Si esto cambia, actualizaremos esta Política y obtendremos los permisos que sean necesarios.",
    ],
  },
  {
    id: "legal-bases",
    title: "4. Bases y responsabilidad de la clínica",
    content: [
      "Cuando el Reglamento General de Protección de Datos u otra ley similar sea aplicable, la base jurídica depende del contexto: ejecución de un contrato, intereses legítimos de seguridad y administración, cumplimiento de obligaciones legales o consentimiento cuando sea necesario.",
      "La clínica es responsable de definir la base jurídica para los datos de sus pacientes, entregarles la información exigida, obtener permisos para mensajes y configurar el Servicio de forma adecuada. Patient Nova no decide el tratamiento clínico de un paciente ni sustituye las obligaciones de la clínica.",
      "No cargues datos de salud, identificativos o documentos si no tienes autorización para hacerlo o si no se han acordado las garantías contractuales, técnicas y organizativas exigibles.",
    ],
  },
  {
    id: "sharing",
    title: "5. Proveedores y divulgación",
    content: [
      "Podemos compartir los datos necesarios con proveedores que ayudan a operar el Servicio, incluidos Twilio para SMS, WhatsApp y estados de entrega; Google para funciones de Google Meet; y proveedores de alojamiento, base de datos, registro, seguridad y soporte que el operador configure. Sus ubicaciones, subencargados y condiciones pueden cambiar.",
      "Podemos divulgar información cuando sea necesario para cumplir una obligación legal, responder a un proceso válido, proteger derechos y seguridad, investigar fraude o hacer cumplir estos Términos. También podemos transferir información como parte de una reorganización, adquisición o venta, sujeto a las garantías y avisos que exija la ley.",
      "No vendemos datos personales ni los utilizamos para publicidad conductual en la implementación actual. Los datos enviados a Twilio, Google u otros proveedores quedan sujetos también a las políticas y condiciones de esos proveedores.",
      "Algunos proveedores pueden tratar datos fuera del país donde se encuentra la clínica. No se declara una región única de alojamiento en esta Política; las transferencias internacionales se realizarán con las salvaguardas que sean exigibles en cada caso.",
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
      "Conservamos los datos mientras la cuenta y el Servicio estén activos, mientras sean necesarios para los fines descritos, o durante el tiempo que exija un contrato, una obligación legal, la seguridad o la resolución de reclamaciones. No declaramos un plazo fijo universal porque la conservación de historiales y documentos depende también de la clínica y de la jurisdicción aplicable.",
      "Algunas entidades se eliminan mediante borrado lógico: pueden dejar de aparecer en la interfaz, pero permanecer en la base de datos y ser restaurables durante un periodo no definido públicamente. Las copias de seguridad, registros técnicos y registros de auditoría pueden conservarse durante el tiempo operativo o legal necesario.",
      "No existe actualmente una promesa técnica de anonimización o borrado completo en 30 días. Para solicitar el cierre de una cuenta o la eliminación de datos, escribe a privacidad@patientnova.net. Evaluaremos la solicitud y aplicaremos las excepciones legales, contractuales y de seguridad correspondientes.",
      "La clínica debe exportar la información que necesite y cumplir sus propias obligaciones de conservación antes de solicitar el cierre. La eliminación de datos no afecta necesariamente a información que debamos conservar por ley o para defender reclamaciones.",
    ],
  },
  {
    id: "security",
    title: "8. Seguridad",
    content: [
      "Aplicamos controles de seguridad que incluyen contraseñas con hash, tokens de sesión con expiración, cookies de autenticación HttpOnly y Secure, control de acceso por roles, aislamiento de datos por cuenta, validación de entradas, limitación de solicitudes, cabeceras de seguridad, bloqueo tras intentos fallidos y registros de actividad.",
      "En producción, la aplicación requiere una clave para cifrar determinados campos sensibles, incluidos algunos datos bancarios y partes de historiales. Esto no significa que todos los campos, archivos, copias de seguridad o sistemas de los proveedores estén cifrados con el mismo mecanismo.",
      "El cifrado de la conexión y el cifrado de la base de datos en reposo dependen también de la infraestructura de despliegue y del proveedor de alojamiento. No afirmamos que ninguna transmisión o sistema sea completamente seguro.",
      "Si detectas un acceso no autorizado o un incidente relacionado con tus datos, notifícalo inmediatamente en privacidad@patientnova.net.",
    ],
  },
  {
    id: "cookies",
    title: "9. Cookies y almacenamiento local",
    content: [
      "El portal utiliza dos cookies propias necesarias para la autenticación: una cookie de acceso con duración corta y una cookie de renovación con duración limitada. Son HttpOnly, Secure y utilizan SameSite=None para permitir el funcionamiento entre el portal y la API configurados por el operador.",
      "El portal guarda la preferencia de tema claro u oscuro en localStorage del navegador. La implementación actual no utiliza cookies de terceros para publicidad ni seguimiento entre sitios.",
      "Si añadimos cookies no necesarias o tecnologías de medición, proporcionaremos la información y el mecanismo de elección que exija la ley antes de utilizarlas.",
    ],
  },
  {
    id: "rights",
    title: "10. Derechos y solicitudes",
    content: [
      "Según la ley aplicable, puedes solicitar acceso, rectificación, supresión, limitación, oposición, portabilidad o información sobre el tratamiento de tus datos. Cuando el tratamiento se base en consentimiento, puedes retirarlo para el futuro sin afectar la licitud del tratamiento anterior.",
      "Si eres paciente, dirige primero la solicitud a la clínica que introdujo tus datos, porque normalmente determina los fines del tratamiento. Si eres usuario de Patient Nova o necesitas contactar con el proveedor, escribe a privacidad@patientnova.net e indica tu relación con la cuenta y el alcance de la solicitud. Podemos pedir información razonable para verificar identidad y autoridad.",
      "La Plataforma no ofrece actualmente una exportación automática ni una pantalla específica para gestionar todas las solicitudes de derechos. Responderemos dentro de los plazos y con las excepciones previstos por la ley aplicable.",
      "También puedes presentar una reclamación ante la autoridad de protección de datos competente en tu lugar de residencia, trabajo o donde se produjo el supuesto incumplimiento. Si resulta aplicable en España, esa autoridad es la AEPD.",
    ],
  },
  {
    id: "changes",
    title: "11. Cambios en esta Política",
    content: [
      "Podemos actualizar esta Política para reflejar cambios legales, técnicos o del Servicio. Publicaremos la nueva versión en esta página con una fecha de actualización. Si el cambio es material, te avisaremos por correo electrónico o dentro de la Plataforma cuando la ley lo exija.",
    ],
  },
  {
    id: "contact",
    title: "12. Contacto",
    content: [
      "Juan Manuel Gallego. 402-1595 rue Lalemant, Sherbrooke, Canada.",
      "Privacidad y solicitudes de derechos: privacidad@patientnova.net",
      "Asuntos legales: legal@patientnova.net",
      "Estos buzones deben estar activos y supervisados. La jurisdicción y cualquier contacto de protección de datos adicional deben completarse en cuanto se confirme la estructura legal del proveedor.",
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
