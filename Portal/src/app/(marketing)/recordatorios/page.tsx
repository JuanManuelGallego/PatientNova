import { FeaturePage } from "@/src/components/Landing/FeaturePage";
import { SCREENSHOTS } from "@/src/components/Landing/screenshots";
import { pageMetadata } from "@/src/utils/seo/pageMetadata";

const PATH = "/recordatorios";

export const metadata = pageMetadata({
    path: PATH,
    title: "Recordatorios de citas por WhatsApp, SMS y correo | Patient Nova",
    description:
        "Reduce las ausencias con recordatorios automáticos de citas por WhatsApp, SMS o correo electrónico, enviados en el momento que elijas.",
});

export default function RemindersPage() {
    return (
        <FeaturePage
            path={PATH}
            badge="Recordatorios"
            title="Recordatorios de citas por WhatsApp, SMS y correo"
            intro="Cada cita puede llevar su recordatorio automático, por el canal que prefiere cada paciente. Menos ausencias y menos mensajes escritos a mano."
            sections={[
                {
                    title: "El canal de cada paciente",
                    paragraphs: [
                        "Cada paciente tiene su canal preferido: WhatsApp, SMS o correo electrónico. El recordatorio sale por ese canal, con tu nombre, la fecha, la hora y el lugar o el enlace de la videollamada.",
                    ],
                },
                {
                    title: "Cuándo se envía",
                    paragraphs: [ "Eliges el momento de cada recordatorio:" ],
                    bullets: [
                        "Una hora antes de la cita.",
                        "Un día antes.",
                        "La mañana del día de la cita.",
                        "La mañana o la tarde del día anterior.",
                        "En una fecha y hora que elijas, o de inmediato.",
                    ],
                },
                {
                    title: "También para las reservas en línea",
                    paragraphs: [
                        "Las citas que reservan tus pacientes desde tu enlace reciben su recordatorio automáticamente, con el momento que configures una sola vez. Si la cita cambia de hora, el recordatorio se mueve con ella; si se cancela, no se envía.",
                    ],
                },
                {
                    title: "Todo a la vista",
                    paragraphs: [
                        "En la sección de recordatorios ves cuáles están programados, cuáles se enviaron y cuáles fallaron, para que nada se quede sin avisar.",
                        "Las citas reservadas en línea guardan la zona horaria del paciente, así que quien vive en otro país recibe la hora correcta en sus mensajes.",
                    ],
                    shot: SCREENSHOTS.reminders,
                },
            ]}
        />
    );
}
