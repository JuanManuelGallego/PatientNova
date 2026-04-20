/**
 * Centralised Spanish UI string constants.
 * Import from here instead of scattering literal strings across components.
 */

// ── Button / action labels ─────────────────────────────────────────
export const LBL_SAVE       = "Guardar cambios" as const;
export const LBL_SAVING     = "Guardando…"      as const;
export const LBL_SAVED      = "✅ Guardado"     as const;
export const LBL_CANCEL     = "Cancelar"        as const;
export const LBL_DELETE     = "Eliminar"        as const;
export const LBL_CLOSE      = "Cerrar"          as const;
export const LBL_CREATE     = "Crear"           as const;
export const LBL_EDIT       = "Editar"          as const;
export const LBL_SEND       = "Enviar"          as const;
export const LBL_CONFIRM    = "Confirmar"       as const;
export const LBL_NEXT       = "Siguiente →"     as const;
export const LBL_BACK       = "← Atrás"         as const;

// Entity-specific create/save labels
export const LBL_CREATE_PATIENT     = "Crear Paciente"    as const;
export const LBL_CREATE_APPOINTMENT = "✓ Crear Cita"      as const;
export const LBL_CREATE_REMINDER    = "Crear Recordatorio" as const;
export const LBL_CREATE_LOCATION    = "Crear ubicación"   as const;
export const LBL_CREATE_APPT_TYPE   = "Crear tipo"        as const;

export const LBL_SAVE_CHANGES = "Guardar Cambios" as const;

// ── Status / feedback labels ───────────────────────────────────────
export const LBL_LOADING         = "Cargando…"          as const;
export const LBL_SAVE_ERROR      = "❌ Error al guardar" as const;
export const LBL_NO_RESULTS      = "Sin resultados"      as const;
export const LBL_NO_PATIENTS     = "No hay pacientes registrados" as const;
export const LBL_NO_REMINDER     = "Sin recordatorio"    as const;

// ── Fallback error messages ────────────────────────────────────────
export const ERR_SAVE            = "Error al guardar"          as const;
export const ERR_LOAD            = "Error al cargar los datos" as const;
export const ERR_GENERIC         = "Ocurrió un error inesperado" as const;
export const ERR_PATIENT_NOT_FOUND = "Paciente no encontrado"  as const;
export const ERR_MSG_EMPTY       = "El mensaje no puede estar vacío" as const;
