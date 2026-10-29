/**
 * Maps API failures to user-facing Spanish. Server messages are English (or mixed) and sometimes
 * technical, so the UI shows these curated strings; the raw server text stays on the error object
 * (`details`) for logging/debugging only.
 */

const PATTERNS: Array<[ RegExp, string ]> = [
    [ /overlaps with another appointment|conflicts with an existing appointment/i, "Ya existe una cita en ese horario." ],
    // Anchored to the overlap wording: "Blocked time with id ... not found" (404) must fall through.
    [ /appointment overlaps with blocked time/i, "Ese horario está bloqueado en la agenda." ],
    [ /blocked time overlaps with an existing blocked slot/i, "Ya existe un bloqueo en ese horario." ],
    [ /patient with this email already exists/i, "Ya existe un paciente con este correo electrónico." ],
    [ /user with email .* already exists/i, "Ya existe un usuario con este correo electrónico." ],
    [ /named .* already exists/i, "Ya existe un registro con ese nombre. Usa un nombre diferente." ],
    [ /consent document for user .* already exists/i, "Ya existe un consentimiento cargado." ],
    [ /medical record for patient .* already exists/i, "Este paciente ya tiene una historia clínica." ],
    [ /meeting URL is required for virtual appointments/i, "Las citas virtuales requieren un enlace de reunión." ],
    [ /patient with id .* does not exist/i, "El paciente seleccionado no existe o fue eliminado." ],
    [ /invalid credentials/i, "Correo o contraseña incorrectos." ],
    [ /account (is |has been )?(temporarily )?locked/i, "La cuenta está bloqueada temporalmente por demasiados intentos. Inténtalo más tarde." ],
    [ /end(At|TimeUtc) must be after start(At|TimeUtc)/i, "La hora de fin debe ser posterior a la hora de inicio." ],
    [ /cannot .* an appointment with status/i, "Esa acción no está permitida para el estado actual de la cita." ],
    [ /cannot schedule or confirm appointment .* in the past/i, "No se puede programar ni confirmar una cita en el pasado." ],
    [ /patient limit reached/i, "Alcanzaste el límite de pacientes de tu cuenta." ],
    [ /booking link is not available/i, "Ese enlace ya está en uso. Elige otro." ],
    [ /slug is reserved/i, "Ese enlace está reservado. Elige otro." ],
    [ /slug may only contain/i, "El enlace solo puede tener letras minúsculas, números y guiones." ],
    [ /online booking cannot be enabled yet/i, "Completa la configuración antes de activar la reserva en línea." ],
    [ /availability cannot be empty while online booking is enabled/i, "Desactiva la reserva en línea antes de quitar toda la disponibilidad." ],
    [ /availability windows overlap/i, "Hay franjas de disponibilidad que se superponen el mismo día." ],
    [ /virtual locations cannot be bookable online/i, "Las ubicaciones virtuales aún no pueden reservarse en línea." ],
    [ /too many requests/i, "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." ],
];

/** `statusMessages` replaces the status fallback (not a matched server message) where context differs. */
export function toSpanishMessage(
    status: number,
    serverMessage?: unknown,
    statusMessages: Partial<Record<number, string>> = {},
): string {
    const text = typeof serverMessage === "string" ? serverMessage : "";
    for (const [ pattern, message ] of PATTERNS) {
        if (pattern.test(text)) return message;
    }
    const override = statusMessages[ status ];
    if (override) return override;
    if (status === 0) return "No pudimos conectar con el servidor. Revisa tu conexión a internet.";
    if (status === 400 || status === 422) return "Revisa los datos ingresados e inténtalo de nuevo.";
    if (status === 401) return "Tu sesión expiró. Inicia sesión de nuevo.";
    if (status === 403) return "No tienes permiso para realizar esta acción.";
    if (status === 404) return "No encontramos lo que buscas.";
    if (status === 423) return "La cuenta está bloqueada temporalmente por demasiados intentos. Inténtalo más tarde.";
    if (status === 409) return "La acción entra en conflicto con el estado actual. Actualiza la página e inténtalo de nuevo.";
    if (status === 413) return "El contenido enviado es demasiado grande.";
    if (status === 429) return "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.";
    if (status >= 500) return "Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.";
    return "No pudimos completar la acción. Inténtalo de nuevo.";
}
