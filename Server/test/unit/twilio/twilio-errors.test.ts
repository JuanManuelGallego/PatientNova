import { describe, it, expect } from 'vitest';
import { resolveTwilioError } from '../../../src/twilio/twilio-errors.js';

describe('resolveTwilioError', () => {
  it('returns Spanish message for known SMS error code 30003', () => {
    expect(resolveTwilioError(30003)).toBe(
      'El número de destino no está localizable (apagado, sin señal o incorrecto).',
    );
  });

  it('returns Spanish message for known SMS error code 30004', () => {
    expect(resolveTwilioError(30004)).toBe('El mensaje fue bloqueado por políticas de cumplimiento.');
  });

  it('returns Spanish message for known SMS error code 30017', () => {
    expect(resolveTwilioError(30017)).toBe('Congestión en la red del operador de telecomunicaciones.');
  });

  it('returns Spanish message for known WhatsApp error code 21614', () => {
    expect(resolveTwilioError(21614)).toBe('El número "To" no es un número móvil válido.');
  });

  it('returns Spanish message for known WhatsApp error code 21408', () => {
    expect(resolveTwilioError(21408)).toBe(
      'Permisos de geobloqueo deshabilitados para la región de destino.',
    );
  });

  it('returns Spanish message for known Verify error code 60005', () => {
    expect(resolveTwilioError(60005)).toBe('Error en la infraestructura del operador downstream.');
  });

  it('returns Spanish message for known Verify error code 60245', () => {
    expect(resolveTwilioError(60245)).toBe('Se excedieron los límites globales de mensajería para esta verificación.');
  });

  it('returns Spanish message for known WhatsApp API error code 63024', () => {
    expect(resolveTwilioError(63024)).toBe(
      'El destinatario no usa WhatsApp o no ha aceptado los términos de servicio.',
    );
  });

  it('returns fallback for unknown error code', () => {
    expect(resolveTwilioError(99999, 'Fallback msg')).toBe('Fallback msg');
  });

  it('returns default message with code for unknown code when no fallback', () => {
    expect(resolveTwilioError(99999)).toBe('Error de entrega no especificado (código 99999)');
  });

  it('returns fallback when errorCode is null', () => {
    expect(resolveTwilioError(null, 'Null fallback')).toBe('Null fallback');
  });

  it('returns default when errorCode is null and no fallback', () => {
    expect(resolveTwilioError(null)).toBe('Error de entrega no especificado');
  });

  it('returns fallback when errorCode is undefined', () => {
    expect(resolveTwilioError(undefined, 'Undef fallback')).toBe('Undef fallback');
  });

  it('returns default when errorCode is undefined and no fallback', () => {
    expect(resolveTwilioError(undefined)).toBe('Error de entrega no especificado');
  });

  it('covers all keys in the dictionary', () => {
    const codes = [
      // General API, Auth & Account (1xxxx & 20xxx)
      10001, 10002, 10003, 10004, 10005,
      20001, 20003, 20005, 20008, 20404, 20429, 20500,
      // Webhook, Network & TwiML (11xxx & 12xxx)
      11100, 11200, 11201, 11202, 11203, 11205, 11206, 11210, 11215, 11216,
      11220, 11235, 11236, 11237, 11300, 11310, 11320, 11321, 11322,
      11750, 11751, 11770,
      12100, 12101, 12102, 12200, 12300, 12400,
      // Voice & Voice SDK (13xxx, 212xx, 31xxx)
      13223, 13224, 21201, 21210, 21215, 21217, 21220,
      31000, 31001, 31002, 31003, 31005, 31009, 31100, 31102, 31105,
      // SMS & Messaging (21xxx & 3xxxx)
      21211, 21212, 21214, 21401, 21402, 21408,
      21601, 21602, 21603, 21604, 21605, 21606, 21608, 21609, 21610, 21611,
      21612, 21614, 21617, 21618, 21619, 21620, 21654, 21655, 21656,
      30001, 30002, 30003, 30004, 30005, 30006, 30007, 30008, 30009, 30010,
      30011, 30017, 30019, 30020, 30021, 30022, 30023, 30029, 30032, 30034,
      30036, 30037, 30038, 30040, 30041, 30042, 30044, 30046, 30047, 30055,
      30450, 30453, 30454,
      // Lookup API (604xx)
      60404, 60410,
      // Verify API (60xxx)
      60001, 60002, 60003, 60004, 60005, 60006, 60007, 60008,
      60200, 60202, 60203, 60204, 60205, 60207, 60212, 60223, 60238, 60245,
      60247, 60300, 60306,
      // WhatsApp & Multi-Channel (210xx & 63xxx)
      21000, 21001, 21002, 21003, 21004,
      63001, 63002, 63003, 63005, 63010, 63012, 63015, 63016, 63018, 63019,
      63020, 63021, 63022, 63024, 63025, 63032, 63038,
    ];
    for (const code of codes) {
      const msg = resolveTwilioError(code);
      expect(msg).toBeTruthy();
      expect(typeof msg).toBe('string');
    }
  });
});
