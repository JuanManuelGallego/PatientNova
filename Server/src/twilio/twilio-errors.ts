/**
 * Maps Twilio numeric error codes to user-friendly Spanish messages.
 *
 * Reference: https://www.twilio.com/docs/api/errors
 */

const TWILIO_ERROR_MESSAGES: Record<number, string> = {
  // ── SMS / Messaging errors (3xxxx) ──────────────────────────────
  30001: 'La cola de mensajes está saturada. Intente más tarde.',
  30002: 'La cuenta de Twilio ha sido suspendida.',
  30003: 'El número de destino no es reachable (apagado, fuera de cobertura o incorrecto).',
  30004: 'El mensaje fue bloqueado.',
  30005: 'El dispositivo de destino es desconocido.',
  30006: 'El número es una línea fija o el operador no es reachable.',
  30007: 'El mensaje fue filtrado por el operador.',
  30008: 'Error desconocido de entrega.',
  30009: 'Falta el segmento de entrada.',
  30010: 'El precio del mensaje excede el máximo permitido.',
  30011: 'MMS no es compatible con el número de destino en esta región.',
  30017: 'Congestión en la red del operador.',
  30019: 'El contenido excede el límite del operador.',
  30020: 'Error interno al programar el mensaje.',
  30021: 'Error interno del servicio de mensajería.',
  30022: 'Límite de velocidad de US A2P 10DLC excedido.',
  30023: 'Límite diario de mensajes de US A2P 10DLC alcanzado.',
  30032: 'El número libre de verificación (Toll-Free) no ha sido verificado.',
  30036: 'El período de validez del mensaje expiró.',
  30037: 'El envío de mensajes está deshabilitado para esta cuenta.',
  30038: 'El cuerpo del mensaje OTP fue filtrado.',
  30040: 'El operador de destino requiere pre-registro del remitente.',
  30041: 'El remitente está restringido o no registrado en un país que lo requiere.',
  30042: 'El ID alfanumérico del remitente no está autorizado para esta cuenta.',
  30044: 'El mensaje excede la longitud permitida para cuentas de prueba.',
  30046: 'La entrega del mensaje no fue confirmada.',
  30047: 'Error al programar el mensaje para una ventana de tiempo compatible.',
  30450: 'El envío del mensaje fue bloqueado.',
  30453: 'El mensaje no pudo ser entregado.',
  30454: 'La cuenta excedió el límite de mensajes.',

  // ── WhatsApp / Messaging errors (21xxx) ──────────────────────────
  21000: 'Error desconocido de WhatsApp.',
  21001: 'El número no es un número válido de WhatsApp.',
  21002: 'La cuenta de WhatsApp no está configurada.',
  21003: 'La entrega del mensaje de WhatsApp falló.',
  21004: 'La cuenta de WhatsApp ha sido suspendida.',
  21211: 'El número de destino no es un número de teléfono válido.',
  21212: 'El número de origen no es válido.',
  21214: 'El número de destino no puede ser alcanzado.',
  21401: 'El número de teléfono no es válido.',
  21402: 'La URL proporcionada no es válida.',
  21408: 'El mensaje fue bloqueado: permisos deshabilitados para la región de destino.',
  21601: 'El número no es un número de entrada compatible con SMS.',
  21602: 'El cuerpo del mensaje es obligatorio.',
  21603: 'Se requiere un parámetro "From" o "MessagingServiceSid" para enviar un mensaje.',
  21604: 'El número de destino "To" es obligatorio para enviar un SMS.',
  21605: 'La longitud máxima del cuerpo es de 160 caracteres.',
  21606: 'El número "From" no es un número de Twilio compatible con mensajes para esta cuenta.',
  21610: 'El destinatario se dio de baja de mensajes.',
  21611: 'El número "From" excedió el máximo de mensajes en cola.',
  21612: 'El mensaje no puede enviarse con la combinación actual de parámetros "To" y/o "From".',
  21614: 'El número "To" no es un número móvil válido.',
  21617: 'El cuerpo del mensaje concatenado excede el límite de 1600 caracteres.',
  21618: 'El cuerpo del mensaje no puede ser enviado.',
  21619: 'Se requiere un cuerpo de mensaje, URL de contenido o SID de contenido.',
  21620: 'URL(s) de medios no válida(s).',
  21654: 'Se requiere ContentSid.',
  21655: 'El ContentSid no es válido.',
  21656: 'El parámetro ContentVariables no es válido.',

  // ── Verify API errors (60xxx) ───────────────────────────────────
  60001: 'Error de autenticación con el proveedor downstream.',
  60002: 'Tiempo de espera agotado al identificar al usuario final.',
  60003: 'Los datos del usuario final no están disponibles.',
  60004: 'Configuración inválida.',
  60005: 'Error del operador downstream.',
  60006: 'El número de teléfono no es válido.',
  60007: 'La verificación downstream falló.',
  60008: 'El operador no es compatible.',
  60203: 'Se alcanzó el máximo de intentos de envío.',
  60205: 'SMS no es compatible con números de línea fija.',
  60207: 'Se alcanzó el límite de velocidad por servicio.',
  60212: 'Demasiadas solicitudes concurrentes para el número de teléfono.',
  60223: 'El canal de entrega está deshabilitado.',
  60238: 'El intento de verificación fue bloqueado por Twilio.',
  60245: 'Se excedieron los límites de mensajería.',
  60247: 'La longitud del mensaje fue excedida.',
  60300: 'Parámetro inválido.',
  60306: 'Solicitud inválida.',
};

const DEFAULT_ERROR = 'Error de entrega no especificado';

/**
 * Resolves a Twilio numeric error code into a user-friendly Spanish message.
 *
 * @param errorCode  - Numeric error code from Twilio (e.g. 30003)
 * @param fallback   - Optional fallback message when the code is unknown
 * @returns          - Human-readable Spanish message
 */
export function resolveTwilioError(
  errorCode: number | null | undefined,
  fallback?: string | null,
): string {
  if (errorCode == null) return fallback ?? DEFAULT_ERROR;
  const mapped = TWILIO_ERROR_MESSAGES[errorCode];
  if (mapped) return mapped;
  if (fallback) return fallback;
  return `${DEFAULT_ERROR} (código ${errorCode})`;
}
