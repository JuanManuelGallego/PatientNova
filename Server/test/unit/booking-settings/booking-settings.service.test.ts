import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bookingSettingsService } from '../../../src/booking-settings/booking-settings.service.js';
import { BookingAvailabilityRequiredError, BookingNotReadyError, BookingSlugTakenError } from '../../../src/booking-settings/booking-settings.errors.js';

const portal = vi.hoisted(() => ({ url: 'https://portal.test', patientEnabled: true }));
vi.mock('../../../src/utils/config/config.js', () => ({ config: { portal } }));

vi.mock('../../../src/booking-settings/booking-settings.repository.js', () => ({
  bookingSettingsRepository: {
    getSettings: vi.fn(),
    getBookingState: vi.fn(),
    updateSettings: vi.fn(),
    getSlugSources: vi.fn(),
    isSlugTakenByOther: vi.fn(),
    getReadiness: vi.fn(),
    listRules: vi.fn(),
    replaceRules: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma/prisma-client.js', () => ({
  prisma: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ tx: true })) },
}));

vi.mock('../../../src/utils/prisma/provider-lock.js', () => ({ withProviderLock: vi.fn() }));

vi.mock('../../../src/audit-log/audit-log.utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/audit-log/audit-log.utils.js')>();
  return { logAudit: vi.fn(), computeDiff: actual.computeDiff };
});

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { bookingSettingsRepository } from '../../../src/booking-settings/booking-settings.repository.js';
import { logAudit } from '../../../src/audit-log/audit-log.utils.js';
import { withProviderLock } from '../../../src/utils/prisma/provider-lock.js';

const repo = vi.mocked(bookingSettingsRepository);
const mockLogAudit = vi.mocked(logAudit);

const settings = {
  timezone: 'America/Bogota',
  bookingSlug: 'dra-maria' as string | null,
  bookingEnabled: false,
  bookingApprovalMode: 'AUTO_CONFIRM' as const,
  slotIntervalMinutes: 30,
  bufferMinutes: 0,
  minLeadMinutes: 120,
  maxHorizonDays: 60,
};
const ready = { hasSlug: true, hasAvailability: true, hasBookableType: true, hasBookableLocation: true };

beforeEach(() => {
  vi.clearAllMocks();
  portal.patientEnabled = true;
  repo.getSettings.mockResolvedValue({ ...settings });
  repo.getReadiness.mockResolvedValue({ ...ready });
  repo.updateSettings.mockImplementation(async (_u, dto) => ({ ...settings, ...dto }) as any);
});

describe('bookingSettingsService.getSettings', () => {
  it('adds the public booking URL and readiness', async () => {
    const r = await bookingSettingsService.getSettings('user-1');
    expect(r.bookingUrl).toMatch(/\/book\/dra-maria$/);
    expect(r.readiness).toEqual(ready);
  });

  it('is live only when enabled and every readiness check passes', async () => {
    expect((await bookingSettingsService.getSettings('user-1')).live).toBe(false);
    repo.getSettings.mockResolvedValue({ ...settings, bookingEnabled: true });
    expect((await bookingSettingsService.getSettings('user-1')).live).toBe(true);
    repo.getReadiness.mockResolvedValue({ ...ready, hasBookableLocation: false });
    expect((await bookingSettingsService.getSettings('user-1')).live).toBe(false);
  });

  it('has no URL without a slug', async () => {
    repo.getSettings.mockResolvedValue({ ...settings, bookingSlug: null });
    expect((await bookingSettingsService.getSettings('user-1')).bookingUrl).toBeNull();
  });
});

describe('bookingSettingsService.updateSettings', () => {
  it('takes the provider lock and writes a required audit in the transaction', async () => {
    await bookingSettingsService.updateSettings('user-1', { bufferMinutes: 10 });
    expect(withProviderLock).toHaveBeenCalledWith({ tx: true }, 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'USER',
      entityId: 'user-1',
      affectedFields: [ 'bufferMinutes' ],
      tx: { tx: true },
      required: true,
    }));
  });

  it('skips the audit when nothing changed', async () => {
    await bookingSettingsService.updateSettings('user-1', { bufferMinutes: 0 });
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it('refuses to enable when readiness is incomplete and lists what is missing', async () => {
    repo.getReadiness.mockResolvedValue({ ...ready, hasAvailability: false, hasBookableLocation: false });
    const err = await bookingSettingsService.updateSettings('user-1', { bookingEnabled: true }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BookingNotReadyError);
    expect((err as BookingNotReadyError).missing).toEqual([ 'availability', 'bookableLocation' ]);
    expect(repo.updateSettings).not.toHaveBeenCalled();
  });

  it('checks readiness against the slug being set in the same request', async () => {
    repo.getSettings.mockResolvedValue({ ...settings, bookingSlug: null });
    await bookingSettingsService.updateSettings('user-1', { bookingSlug: 'nuevo', bookingEnabled: true });
    expect(repo.getReadiness).toHaveBeenCalledWith('user-1', 'nuevo', { tx: true });
  });

  it('allows disabling even when not ready', async () => {
    repo.getReadiness.mockResolvedValue({ hasSlug: false, hasAvailability: false, hasBookableType: false, hasBookableLocation: false });
    await expect(bookingSettingsService.updateSettings('user-1', { bookingEnabled: false })).resolves.toBeDefined();
  });

  it('clearing the slug also disables booking', async () => {
    repo.getSettings.mockResolvedValue({ ...settings, bookingEnabled: true });
    await bookingSettingsService.updateSettings('user-1', { bookingSlug: null });
    expect(repo.updateSettings).toHaveBeenCalledWith('user-1', { bookingSlug: null, bookingEnabled: false }, { tx: true });
  });

  it('maps a unique violation to a neutral 409', async () => {
    repo.updateSettings.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(bookingSettingsService.updateSettings('user-1', { bookingSlug: 'otro' })).rejects.toBeInstanceOf(BookingSlugTakenError);
  });
});

describe('bookingSettingsService.isBookingLive', () => {
  const state = { status: 'ACTIVE' as const, deletedAt: null as Date | null, bookingEnabled: true, bookingSlug: 'dra-maria' };

  beforeEach(() => {
    repo.getBookingState.mockResolvedValue({ ...state });
  });

  it('is live for an active, enabled and ready provider, checking on the given transaction', async () => {
    await expect(bookingSettingsService.isBookingLive('user-1', { tx: true } as any)).resolves.toBe(true);
    expect(repo.getBookingState).toHaveBeenCalledWith('user-1', { tx: true });
    expect(repo.getReadiness).toHaveBeenCalledWith('user-1', 'dra-maria', { tx: true });
  });

  it('is not live when readiness lapsed after enabling', async () => {
    repo.getReadiness.mockResolvedValue({ ...ready, hasBookableType: false });
    await expect(bookingSettingsService.isBookingLive('user-1')).resolves.toBe(false);
  });

  it.each([
    [ 'disabled', { bookingEnabled: false } ],
    [ 'inactive', { status: 'SUSPENDED' } ],
    [ 'deleted', { deletedAt: new Date() } ],
  ])('is not live for a %s provider', async (_label, override) => {
    repo.getBookingState.mockResolvedValue({ ...state, ...override } as any);
    await expect(bookingSettingsService.isBookingLive('user-1')).resolves.toBe(false);
  });

  it('is not live for an unknown provider or with ENABLE_PORTAL off', async () => {
    repo.getBookingState.mockResolvedValue(null);
    await expect(bookingSettingsService.isBookingLive('nope')).resolves.toBe(false);
    repo.getBookingState.mockResolvedValue({ ...state });
    portal.patientEnabled = false;
    await expect(bookingSettingsService.isBookingLive('user-1')).resolves.toBe(false);
  });
});

describe('bookingSettingsService.suggestSlug', () => {
  it('derives from displayName, falling back to first/last name', async () => {
    repo.isSlugTakenByOther.mockResolvedValue(false);
    repo.getSlugSources.mockResolvedValue({ displayName: 'Psic. Ana Ruiz', firstName: 'Ana', lastName: 'Ruiz', bookingSlug: null });
    expect(await bookingSettingsService.suggestSlug('user-1')).toEqual({ slug: 'psic-ana-ruiz' });
    repo.getSlugSources.mockResolvedValue({ displayName: null, firstName: 'Ana', lastName: 'Ruiz', bookingSlug: null });
    expect(await bookingSettingsService.suggestSlug('user-1')).toEqual({ slug: 'ana-ruiz' });
  });
});

describe('bookingSettingsService.replaceAvailability', () => {
  const rule = { weekday: 1, startMinute: 540, endMinute: 720 };

  it('replaces under the lock and audits before/after', async () => {
    repo.listRules.mockResolvedValue([]);
    repo.replaceRules.mockResolvedValue([ { id: 'r1', userId: 'user-1', ...rule } ] as any);
    const r = await bookingSettingsService.replaceAvailability('user-1', { rules: [ rule ] });
    expect(withProviderLock).toHaveBeenCalled();
    expect(r).toEqual({ timezone: 'America/Bogota', rules: [ rule ] });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      affectedFields: [ 'availability' ],
      fieldsBefore: { availability: [] },
      fieldsAfter: { availability: [ rule ] },
      required: true,
    }));
  });

  it('does not audit an unchanged week', async () => {
    repo.listRules.mockResolvedValue([ { id: 'r1', ...rule } ] as any);
    repo.replaceRules.mockResolvedValue([ { id: 'r2', ...rule } ] as any);
    await bookingSettingsService.replaceAvailability('user-1', { rules: [ rule ] });
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it('refuses an empty week while booking is enabled', async () => {
    repo.getSettings.mockResolvedValue({ ...settings, bookingEnabled: true });
    await expect(bookingSettingsService.replaceAvailability('user-1', { rules: [] })).rejects.toBeInstanceOf(BookingAvailabilityRequiredError);
    expect(repo.replaceRules).not.toHaveBeenCalled();
  });
});
