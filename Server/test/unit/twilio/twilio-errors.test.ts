import { describe, it, expect } from 'vitest';
import { resolveTwilioError } from '../../../src/twilio/twilio-errors.js';

describe('resolveTwilioError', () => {
  it('returns Spanish message for known SMS error code 30003', () => {
    expect(resolveTwilioError(30003)).toBe(
      'El número de destino no es reachable (apagado, fuera de cobertura o incorrecto).',
    );
  });

  it('returns Spanish message for known SMS error code 30004', () => {
    expect(resolveTwilioError(30004)).toBe('El mensaje fue bloqueado.');
  });

  it('returns Spanish message for known SMS error code 30017', () => {
    expect(resolveTwilioError(30017)).toBe('Congestión en la red del operador.');
  });

  it('returns Spanish message for known WhatsApp error code 21614', () => {
    expect(resolveTwilioError(21614)).toBe('El número "To" no es un número móvil válido.');
  });

  it('returns Spanish message for known WhatsApp error code 21408', () => {
    expect(resolveTwilioError(21408)).toBe(
      'El mensaje fue bloqueado: permisos deshabilitados para la región de destino.',
    );
  });

  it('returns Spanish message for known Verify error code 60005', () => {
    expect(resolveTwilioError(60005)).toBe('Error del operador downstream.');
  });

  it('returns Spanish message for known Verify error code 60245', () => {
    expect(resolveTwilioError(60245)).toBe('Se excedieron los límites de mensajería.');
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
      // SMS / Messaging (3xxxx)
      30001, 30002, 30003, 30004, 30005, 30006, 30007, 30008, 30009, 30010,
      30011, 30017, 30019, 30020, 30021, 30022, 30023, 30032, 30036, 30037,
      30038, 30040, 30041, 30042, 30044, 30046, 30047, 30450, 30453, 30454,
      // WhatsApp / Messaging (21xxx)
      21000, 21001, 21002, 21003, 21004, 21211, 21212, 21214, 21401, 21402,
      21408, 21601, 21602, 21603, 21604, 21605, 21606, 21610, 21611, 21612,
      21614, 21617, 21618, 21619, 21620, 21654, 21655, 21656,
      // Verify API (60xxx)
      60001, 60002, 60003, 60004, 60005, 60006, 60007, 60008, 60203, 60205,
      60207, 60212, 60223, 60238, 60245, 60247, 60300, 60306,
    ];
    for (const code of codes) {
      const msg = resolveTwilioError(code);
      expect(msg).toBeTruthy();
      expect(typeof msg).toBe('string');
    }
  });
});
