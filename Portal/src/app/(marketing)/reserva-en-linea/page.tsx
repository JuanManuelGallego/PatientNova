import { FeaturePage } from "@/src/components/Landing/FeaturePage";
import { pageMetadata } from "@/src/utils/seo/pageMetadata";

const PATH = "/reserva-en-linea";

export const metadata = pageMetadata({
    path: PATH,
    title: "Agenda en línea para tu consulta | Patient Nova",
    description:
        "Tus pacientes reservan su cita desde un enlace, sin crear cuenta, y la confirman por correo o WhatsApp. Tú decides horarios, servicios y si apruebas cada solicitud.",
});

export default function OnlineBookingPage() {
    return (
        <FeaturePage
            path={PATH}
            badge="Reserva en línea"
            title="Agenda en línea para tu consulta"
            intro="Comparte un enlace y deja que tus pacientes elijan el servicio, el día y la hora. Sin llamadas de ida y vuelta, sin citas cruzadas y sin pedirles que creen una cuenta."
            sections={[
                {
                    title: "Cómo reservan tus pacientes",
                    paragraphs: [
                        "Tu página de reservas muestra tus servicios con su duración y precio, tus consultorios o la opción virtual, y solo los horarios que de verdad tienes libres.",
                        "El paciente elige, escribe su nombre y su correo o WhatsApp, y recibe un enlace para confirmar. Mientras tanto el horario queda apartado para que nadie más lo tome. La cita se agenda cuando el paciente confirma; si no lo hace, el horario se libera solo.",
                    ],
                },
                {
                    title: "Tú pones las reglas",
                    bullets: [
                        "Tu horario semanal de atención, por días y franjas.",
                        "Qué servicios y qué consultorios se pueden reservar en línea.",
                        "Con cuánta anticipación mínima se puede reservar y hasta cuántos días adelante.",
                        "Tiempo de descanso entre citas y cada cuánto empiezan los horarios disponibles.",
                        "Confirmación inmediata, o revisar y aprobar cada solicitud antes de que se convierta en cita.",
                    ],
                },
                {
                    title: "Sin cruces con tu agenda",
                    paragraphs: [
                        "Las reservas en línea y las citas que agendas tú comparten el mismo calendario. Un horario ocupado, bloqueado o apartado por otra reserva no se ofrece, y tu agenda siempre tiene prioridad sobre una reserva que el paciente aún no ha confirmado.",
                    ],
                },
                {
                    title: "Citas virtuales con Google Meet",
                    paragraphs: [
                        "Si conectas tu cuenta de Google, las citas virtuales que reservan tus pacientes reciben su enlace de Google Meet automáticamente, y el paciente lo recibe en sus mensajes.",
                    ],
                },
                {
                    title: "Tu enlace, en todas partes",
                    paragraphs: [
                        "Tienes una dirección propia y un código QR para tu perfil de Instagram, tu firma de correo, tu consultorio o tus tarjetas. Si quieres, tu página también puede aparecer en Google con tu nombre, especialidad y presentación.",
                        "Antes de reservar, el paciente ve quién responde por sus datos y cómo contactarte sin usar el portal, y autoriza el tratamiento de sus datos personales.",
                    ],
                },
            ]}
        />
    );
}
