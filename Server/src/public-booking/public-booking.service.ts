import { DateTime } from 'luxon';
import { bookingSlugSchema } from '../booking-settings/booking-settings.schemas.js';
import { bookingSettingsRepository } from '../booking-settings/booking-settings.repository.js';
import { bookingSettingsService } from '../booking-settings/booking-settings.service.js';
import { localToUtc } from '../utils/time/time-utils.js';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';
import { generateSlots } from './slot-engine.js';
import { publicBookingRepository, type ProviderImageKind } from './public-booking.repository.js';
import { ProviderImageNotFoundError, ProviderNotFoundError, PublicAppointmentTypeNotFoundError } from './public-booking.errors.js';
import type { SlotsQuery } from './public-booking.schemas.js';

const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,/;

function localMidnightUtc(isoDate: string, timezone: string, plusDays = 0): Date {
  const d = DateTime.fromISO(isoDate, { zone: 'UTC' }).plus({ days: plusDays });
  return localToUtc(d.year, d.month, d.day, 0, 0, 0, timezone);
}

export function providerDisplayName(p: { displayName: string | null; firstName: string | null; lastName: string | null }): string {
  return p.displayName?.trim() || [ p.firstName, p.lastName ].filter(Boolean).join(' ');
}

export const publicBookingService = {
  async resolveProvider(rawSlug: string) {
    const slug = bookingSlugSchema.safeParse(rawSlug);
    if (!slug.success) throw new ProviderNotFoundError();
    const provider = await publicBookingRepository.findProviderBySlug(slug.data);
    if (!provider || !(await bookingSettingsService.isBookingLive(provider.id))) throw new ProviderNotFoundError();
    return provider;
  },

  async getProfile(slug: string) {
    const provider = await publicBookingService.resolveProvider(slug);
    const [ images, types, locations ] = await Promise.all([
      publicBookingRepository.getImages(provider.id),
      publicBookingRepository.listBookableTypes(provider.id),
      publicBookingRepository.listBookableLocations(provider.id),
    ]);
    return {
      displayName: providerDisplayName(provider),
      jobTitle: provider.jobTitle,
      hasAvatar: IMAGE_DATA_URL.test(images?.avatar ?? ''),
      hasLogo: IMAGE_DATA_URL.test(images?.logo ?? ''),
      timezone: provider.timezone,
      lastBookableDate: DateTime.now().setZone(provider.timezone).plus({ days: provider.maxHorizonDays - 1 }).toISODate(),
      types: types.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        durationMinutes: t.defaultDuration,
        price: t.defaultPrice,
      })),
      locations,
    };
  },

  async getImage(slug: string, kind: ProviderImageKind): Promise<{ contentType: string; bytes: Buffer }> {
    const provider = await publicBookingService.resolveProvider(slug);
    const dataUrl = await publicBookingRepository.getImage(provider.id, kind);
    const match = dataUrl ? IMAGE_DATA_URL.exec(dataUrl) : null;
    if (!dataUrl || !match) throw new ProviderImageNotFoundError();
    return { contentType: match[1]!, bytes: Buffer.from(dataUrl.slice(match[0].length), 'base64') };
  },

  async getSlots(slug: string, query: SlotsQuery) {
    const provider = await publicBookingService.resolveProvider(slug);
    const type = await publicBookingRepository.findBookableType(provider.id, query.typeId);
    if (!type) throw new PublicAppointmentTypeNotFoundError();
    const slots = await computeSlots(provider.id, provider, type.defaultDuration, query);
    return { timezone: provider.timezone, slots };
  },
};

export interface SlotSettings {
  timezone: string;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minLeadMinutes: number;
  maxHorizonDays: number;
}

/**
 * Bookable start times over local days `from`..`to` (provider zone). The one slot computation behind the
 * public slots and the portal reschedule slots; `excludeAppointmentId` lets an appointment being moved
 * not block its own neighbourhood.
 */
export async function computeSlots(
  userId: string,
  settings: SlotSettings,
  durationMinutes: number,
  range: { from: string; to: string },
  opts: { excludeAppointmentId?: string; tx?: TransactionClient } = {},
): Promise<Array<{ startUtc: string; endUtc: string }>> {
  const { timezone } = settings;
  const [ rules, busy ] = await Promise.all([
    bookingSettingsRepository.listRules(userId, opts.tx),
    publicBookingRepository.loadBusy(
      userId,
      localMidnightUtc(range.from, timezone),
      localMidnightUtc(range.to, timezone, 1),
      settings.bufferMinutes,
      opts.tx,
      opts.excludeAppointmentId ? { excludeAppointmentId: opts.excludeAppointmentId } : {},
    ),
  ]);

  const slots = generateSlots({
    timezone,
    rules,
    fromDate: range.from,
    toDate: range.to,
    durationMinutes,
    slotIntervalMinutes: settings.slotIntervalMinutes,
    bufferMinutes: settings.bufferMinutes,
    minLeadMinutes: settings.minLeadMinutes,
    maxHorizonDays: settings.maxHorizonDays,
    now: new Date(),
    busy: { ...busy, holds: [] },
  });
  return slots.map((s) => ({ startUtc: s.startUtc.toISOString(), endUtc: s.endUtc.toISOString() }));
}
