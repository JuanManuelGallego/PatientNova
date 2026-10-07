/**
 * Maps API failures to user-facing Spanish. Server messages are English (or mixed) and sometimes
 * technical, so the UI shows these curated strings; the raw server text stays on the error object
 * (`details`) for logging/debugging only.
 */

const PATTERNS: Array<[ RegExp, string ]> = [
    [ /overlaps with another appointment|conflicts with an existing appointment/i, "Ya existe una cita en ese horario." ],
    [ /blocked time/i, "Ese horario está bloqueado en la agenda." ],
    [ /patient with this email already exists/i, "Ya existe un paciente con este correo electrónico." ],
    [ /invalid credentials/i, "Correo o contraseña incorrectos." ],
    [ /account.*locked|locked/i, "La cuenta está bloqueada temporalmente por demasiados intentos. Inténtalo más tarde." ],
    [ /endAt must be after startAt/i, "La hora de fin debe ser posterior a la hora de inicio." ],
    [ /cannot .* an appointment with status/i, "Esa acción no está permitida para el estado actual de la cita." ],
    [ /cannot update past appointment/i, "No se puede reactivar una cita que ya pasó." ],
    [ /too many requests/i, "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." ],
];

export function toSpanishMessage(status: number, serverMessage?: unknown): string {
    const text = typeof serverMessage === "string" ? serverMessage : "";
    for (const [ pattern, message ] of PATTERNS) {
        if (pattern.test(text)) return message;
    }
    if (status === 0) return "No pudimos conectar con el servidor. Revisa tu conexión a internet.";
    if (status === 400 || status === 422) return "Revisa los datos ingresados e inténtalo de nuevo.";
    if (status === 401) return "Tu sesión expiró. Inicia sesión de nuevo.";
    if (status === 403) return "No tienes permiso para realizar esta acción.";
    if (status === 404) return "No encontramos lo que buscas.";
    if (status === 409) return "La acción entra en conflicto con el estado actual. Actualiza la página e inténtalo de nuevo.";
    if (status === 413) return "El contenido enviado es demasiado grande.";
    if (status === 429) return "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.";
    if (status >= 500) return "Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.";
    return "No pudimos completar la acción. Inténtalo de nuevo.";
}
