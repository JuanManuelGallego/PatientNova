import { DateTime } from 'luxon';
import { BookingApprovalMode } from '../../generated/prisma/enums.js';
import { bookingSlugSchema } from '../booking-settings/booking-settings.schemas.js';
import { bookingSettingsRepository } from '../booking-settings/booking-settings.repository.js';
import { bookingSettingsService } from '../booking-settings/booking-settings.service.js';
import { localToUtc } from '../utils/time/time-utils.js';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';
import { generateSlots, isSlotAvailable, type SlotRules } from './slot-engine.js';
import { publicBookingRepository, type ProviderImageKind } from './public-booking.repository.js';
import { bookingRequestRepository } from '../booking-requests/booking-request.repository.js';
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

export type ProviderRequirement = 'reachable' | 'live';

export const publicBookingService = {
  async resolveProvider(rawSlug: string, require: ProviderRequirement = 'live') {
    const slug = bookingSlugSchema.safeParse(rawSlug);
    if (!slug.success) throw new ProviderNotFoundError();
    const provider = await publicBookingRepository.findProviderBySlug(slug.data);
    if (!provider) throw new ProviderNotFoundError();
    const ok = require === 'live'
      ? await bookingSettingsService.isBookingLive(provider.id)
      : await bookingSettingsService.isPortalReachable(provider.id);
    if (!ok) throw new ProviderNotFoundError();
    return provider;
  },

  async getProfile(slug: string) {
    const provider = await publicBookingService.resolveProvider(slug, 'reachable');
    const bookingOpen = await bookingSettingsService.isBookingLive(provider.id);
    const [ images, types, locations ] = await Promise.all([
      publicBookingRepository.getImages(provider.id),
      bookingOpen ? publicBookingRepository.listBookableTypes(provider.id) : [],
      bookingOpen ? publicBookingRepository.listBookableLocations(provider.id) : [],
    ]);
    const selfBooking = bookingOpen && provider.bookingApprovalMode === BookingApprovalMode.AUTO_CONFIRM;
    return {
      displayName: providerDisplayName(provider),
      jobTitle: provider.jobTitle,
      specialty: provider.specialty,
      professionalLicense: provider.professionalLicense,
      bio: provider.bio,
      phone: provider.publicPhone,
      whatsapp: provider.publicWhatsapp,
      hasAvatar: IMAGE_DATA_URL.test(images?.avatar ?? ''),
      hasLogo: IMAGE_DATA_URL.test(images?.logo ?? ''),
      timezone: provider.timezone,
      bookingOpen,
      approvalRequired: bookingOpen && provider.bookingApprovalMode === BookingApprovalMode.REQUIRE_APPROVAL,
      reschedulePolicy: selfBooking
        ? { maxReschedules: provider.maxPatientReschedules, minNoticeHours: provider.minRescheduleNoticeHours }
        : null,
      lastBookableDate: DateTime.now().setZone(provider.timezone).plus({ days: provider.maxHorizonDays - 1 }).toISODate(),
      types: types.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        durationMinutes: t.defaultDuration,
        price: t.defaultPrice,
      })),
      locations: locations.map((l) => ({ id: l.id, name: l.name, address: l.isVirtual ? null : l.address, isVirtual: l.isVirtual })),
    };
  },

  async getImage(slug: string, kind: ProviderImageKind): Promise<{ contentType: string; bytes: Buffer }> {
    const provider = await publicBookingService.resolveProvider(slug, 'reachable');
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
  opts: SlotOptions = {},
): Promise<Array<{ startUtc: string; endUtc: string }>> {
  const from = localMidnightUtc(range.from, settings.timezone);
  const to = localMidnightUtc(range.to, settings.timezone, 1);
  const rules = await slotRules(userId, settings, durationMinutes, from, to, new Date(), opts);
  return generateSlots({ ...rules, fromDate: range.from, toDate: range.to })
    .map((s) => ({ startUtc: s.startUtc.toISOString(), endUtc: s.endUtc.toISOString() }));
}

/** Whether one start time is bookable, under the same rules as `computeSlots` (booking and reschedule). */
export async function isSlotFree(
  userId: string,
  settings: SlotSettings,
  durationMinutes: number,
  start: Date,
  now: Date,
  opts: SlotOptions = {},
): Promise<boolean> {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return isSlotAvailable(start, await slotRules(userId, settings, durationMinutes, start, end, now, opts));
}

interface SlotOptions {
  excludeAppointmentId?: string | undefined;
  excludeRequestId?: string | undefined;
  tx?: TransactionClient | undefined;
}

async function slotRules(
  userId: string,
  settings: SlotSettings,
  durationMinutes: number,
  from: Date,
  to: Date,
  now: Date,
  { excludeAppointmentId, excludeRequestId, tx }: SlotOptions,
): Promise<SlotRules> {
  const [ rules, busy, holds ] = await Promise.all([
    bookingSettingsRepository.listRules(userId, tx),
    publicBookingRepository.loadBusy(userId, from, to, settings.bufferMinutes, tx, { excludeAppointmentId }),
    bookingRequestRepository.loadLiveHolds(userId, from, to, settings.bufferMinutes, now, tx, { excludeRequestId }),
  ]);
  return {
    timezone: settings.timezone,
    rules,
    durationMinutes,
    slotIntervalMinutes: settings.slotIntervalMinutes,
    bufferMinutes: settings.bufferMinutes,
    minLeadMinutes: settings.minLeadMinutes,
    maxHorizonDays: settings.maxHorizonDays,
    now,
    busy: { ...busy, holds },
  };
}
