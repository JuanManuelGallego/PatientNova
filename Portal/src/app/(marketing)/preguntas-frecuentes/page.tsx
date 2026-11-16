import Link from "next/link";
import {
    MarketingCta, MarketingFooter, MarketingLoginLink, MarketingNav, MarketingNavActions,
} from "@/src/components/Landing/MarketingChrome";
import { SUPPORT_EMAIL, WHATSAPP_CONTACT_HREF } from "@/src/config/site";
import { pageMetadata } from "@/src/utils/seo/pageMetadata";

const PATH = "/preguntas-frecuentes";

export const metadata = pageMetadata({
    path: PATH,
    title: "Preguntas frecuentes | Patient Nova",
    description:
        "Cómo empezar, precios, cómo reservan tus pacientes, recordatorios por WhatsApp, citas virtuales y protección de datos en Patient Nova.",
});

interface Faq {
    q: string;
    a: React.ReactNode;
}

const FAQS: Faq[] = [
    {
        q: "¿Qué es Patient Nova?",
        a: "Una plataforma web para llevar tu consulta: pacientes, agenda y calendario, reservas en línea, recordatorios automáticos e historia clínica, en un solo lugar.",
    },
    {
        q: "¿Para quién es?",
        a: "Para profesionales de la salud que atienden pacientes en consultorio o de forma virtual. La agenda, las reservas en línea y los recordatorios sirven para cualquier especialidad; la historia clínica tiene hoy la estructura de la consulta psicológica, individual y familiar.",
    },
    {
        q: "¿Cómo empiezo?",
        a: (
            <>
                Escríbenos por <a href={WHATSAPP_CONTACT_HREF} target="_blank" rel="noopener noreferrer">WhatsApp</a>{" "}
                o a <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Creamos tu cuenta y te ayudamos a
                configurar tus servicios, tu horario y tu enlace de reservas.
            </>
        ),
    },
    {
        q: "¿Cuánto cuesta?",
        a: (
            <>
                Escríbenos por <a href={WHATSAPP_CONTACT_HREF} target="_blank" rel="noopener noreferrer">WhatsApp</a>{" "}
                o a <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> y te contamos los planes y precios
                según tu consulta.
            </>
        ),
    },
    {
        q: "¿Mis pacientes tienen que crear una cuenta o instalar algo?",
        a: "No. Reservan desde tu enlace en el navegador, escriben su nombre y su correo o WhatsApp, y confirman con el enlace que reciben.",
    },
    {
        q: "¿Cómo se confirma una reserva en línea?",
        a: "El paciente recibe un enlace por correo o WhatsApp, según elija. El horario queda apartado unos minutos y la cita se agenda cuando el paciente pulsa confirmar. Si no confirma, el horario se libera solo.",
    },
    {
        q: "¿Puedo revisar cada reserva antes de aceptarla?",
        a: "Sí. En el modo de aprobación, cada reserva confirmada llega a tus solicitudes y aparta el horario mientras decides. Al aprobarla se crea la cita; si la rechazas, el paciente recibe un aviso.",
    },
    {
        q: "¿Por dónde llegan los recordatorios?",
        a: (
            <>
                Por el canal de cada paciente: WhatsApp, SMS o correo electrónico, en el momento que elijas. Más
                detalles en <Link href="/recordatorios">recordatorios</Link>.
            </>
        ),
    },
    {
        q: "¿Puedo atender citas virtuales?",
        a: "Sí. Si conectas tu cuenta de Google, las citas virtuales que reservan tus pacientes reciben su enlace de Google Meet automáticamente. En las citas que agendas tú, agregas el enlace de la videollamada.",
    },
    {
        q: "¿Mi página de reservas aparece en Google?",
        a: "Solo si tú lo decides. Por defecto, tu página la ve únicamente quien tiene tu enlace. Puedes activar «Aparecer en Google» en la configuración de tu reserva en línea, y aplica mientras las reservas estén abiertas.",
    },
    {
        q: "¿Funciona en el celular?",
        a: "Sí. Patient Nova funciona en el navegador del computador, la tableta o el celular, para ti y para tus pacientes.",
    },
    {
        q: "¿Cómo protegen los datos de mis pacientes?",
        a: (
            <>
                Los datos de identificación y contacto se guardan cifrados, el acceso es por usuario y cada cambio queda
                registrado. El tratamiento sigue la Ley 1581 de 2012; lee nuestra{" "}
                <Link href="/privacy-policy">política de privacidad</Link>.
            </>
        ),
    },
];

export default function FaqPage() {
    return (
        <>
            <MarketingNav current={PATH} action={<MarketingNavActions login={<MarketingLoginLink />} />} />
            <main>
                <section className="landing-hero">
                    <div className="landing-container">
                        <div className="landing-hero__badge">Preguntas frecuentes</div>
                        <h1 className="landing-hero__title">Preguntas frecuentes sobre Patient Nova</h1>
                        <p className="landing-hero__subtitle">
                            Lo que más nos preguntan los profesionales antes de empezar.
                        </p>
                    </div>
                </section>
                <section className="landing-section">
                    <div className="landing-container marketing-prose">
                        {FAQS.map((f) => (
                            <details key={f.q} className="marketing-faq">
                                <summary><h2>{f.q}</h2></summary>
                                <p>{f.a}</p>
                            </details>
                        ))}
                    </div>
                </section>
                <MarketingCta />
            </main>
            <MarketingFooter />
        </>
    );
}
