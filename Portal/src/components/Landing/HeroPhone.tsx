import { MessageCircle } from "lucide-react";

const DAYS = [
    { weekday: "lun", day: "17" },
    { weekday: "mar", day: "18", selected: true },
    { weekday: "mié", day: "19" },
    { weekday: "jue", day: "20" },
];

const TIMES = [
    { time: "8:00 a. m." },
    { time: "9:00 a. m.", selected: true },
    { time: "10:30 a. m." },
    { time: "2:00 p. m." },
    { time: "3:00 p. m." },
    { time: "4:30 p. m." },
];

/**
 * The landing hero's picture: the patient's side of the product, drawn in markup so it stays sharp
 * and costs no image download. It copies the real booking flow (the time step of `BookingFlow`,
 * with `SlotChooser`'s day strip and times) and the WhatsApp reminder that follows. Keep it in step
 * when that flow changes. The example provider and times are illustrative.
 */
export function HeroPhone() {
    return (
        <div
            className="hero-phone"
            role="img"
            aria-label="Ejemplo: un paciente elige día y hora en la página de reservas de su profesional desde el celular, y recibe el recordatorio de la cita por WhatsApp."
        >
            <div className="hero-phone__device">
                <div className="hero-phone__screen">
                    <div className="hero-phone__notch" />
                    <div className="hero-phone__provider">
                        <span className="hero-phone__avatar">NR</span>
                        <span>
                            <span className="hero-phone__name">Dra. Natalia Ríos</span>
                            <span className="hero-phone__role">Nutricionista dietista</span>
                        </span>
                    </div>
                    <p className="hero-phone__step">¿Cuándo te queda bien?</p>
                    <p className="hero-phone__label">Elige un día</p>
                    <div className="hero-phone__days">
                        {DAYS.map((d) => (
                            <span key={d.day} className="hero-phone__day" data-selected={d.selected || undefined}>
                                <span className="hero-phone__weekday">{d.weekday}</span>
                                <span className="hero-phone__daynum">{d.day}</span>
                            </span>
                        ))}
                    </div>
                    <p className="hero-phone__label">Horarios del martes 18</p>
                    <div className="hero-phone__times">
                        {TIMES.map((t) => (
                            <span key={t.time} className="hero-phone__time" data-selected={t.selected || undefined}>
                                {t.time}
                            </span>
                        ))}
                    </div>
                    <div className="hero-phone__home" />
                </div>
            </div>
            <div className="hero-phone__message">
                <div className="hero-phone__message-head">
                    <span className="hero-phone__wa">
                        <MessageCircle size={13} strokeWidth={2.5} />
                    </span>
                    WhatsApp
                    <span className="hero-phone__message-time">ahora</span>
                </div>
                <p className="hero-phone__message-text">
                    Recordatorio: tu cita con Dra. Natalia Ríos es mañana, martes 18, a las 9:00 a. m. en el
                    Consultorio 302.
                </p>
            </div>
        </div>
    );
}
