import { bookingSettingsRepository, type BookingReadiness } from './booking-settings.repository.js';
import {
  BookingAvailabilityRequiredError,
  BookingNotReadyError,
  BookingSlugTakenError,
  type BookingReadinessKey,
} from './booking-settings.errors.js';
import { updateBookingSettingsSchema, type ReplaceAvailabilityDto, type UpdateBookingSettingsDto } from './booking-settings.schemas.js';
import { suggestSlug } from './slug.js';
import { logger } from '../utils/api/logger.js';
import { config } from '../utils/config/config.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';
import { EntityType, ActionType, AdminStatus } from '../../generated/prisma/enums.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { isPrismaUniqueConstraintError } from '../utils/errors/prisma-errors.js';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const BOOKING_SETTINGS_DIFF_FIELDS = schemaKeys(updateBookingSettingsSchema);

const READINESS_KEYS: Record<keyof BookingReadiness, BookingReadinessKey> = {
  hasSlug: 'slug',
  hasAvailability: 'availability',
  hasBookableType: 'bookableType',
  hasBookableLocation: 'bookableLocation',
};

type Settings = Awaited<ReturnType<typeof bookingSettingsRepository.getSettings>>;

export function bookingUrl(slug: string | null): string | null {
  return slug ? `${config.portal.url.replace(/\/+$/, '')}/book/${slug}` : null;
}

function missingFrom(readiness: BookingReadiness): BookingReadinessKey[] {
  return (Object.keys(READINESS_KEYS) as (keyof BookingReadiness)[])
    .filter((k) => !readiness[k])
    .map((k) => READINESS_KEYS[k]);
}

function isReady(readiness: BookingReadiness): boolean {
  return missingFrom(readiness).length === 0;
}

// `live` is what the public link does right now: readiness can lapse after enabling
// (e.g. the last bookable location is deleted), and the Portal warns when enabled but not live.
function toResponse(settings: Settings, readiness: BookingReadiness) {
  return {
    ...settings,
    bookingUrl: bookingUrl(settings.bookingSlug),
    readiness,
    live: settings.bookingEnabled && isReady(readiness),
  };
}

function toRuleView(r: { weekday: number; startMinute: number; endMinute: number }) {
  return { weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute };
}

export const bookingSettingsService = {
  async getSettings(userId: string) {
    const settings = await bookingSettingsRepository.getSettings(userId);
    const readiness = await bookingSettingsRepository.getReadiness(userId, settings.bookingSlug);
    return toResponse(settings, readiness);
  },

  async updateSettings(userId: string, dto: UpdateBookingSettingsDto) {
    const result = await prisma.$transaction(async (tx) => {
      // Serializes with availability replacement. Readiness is only enforced when enabling: deleting or
      // un-marking the last bookable type/location later doesn't disable booking (see isBookingLive).
      await withProviderLock(tx, userId);
      const existing = await bookingSettingsRepository.getSettings(userId, tx);

      const changes: UpdateBookingSettingsDto = { ...dto };
      // A cleared slug leaves no link to book through.
      if (changes.bookingSlug === null) changes.bookingEnabled = false;

      const slug = changes.bookingSlug !== undefined ? changes.bookingSlug : existing.bookingSlug;
      const readiness = await bookingSettingsRepository.getReadiness(userId, slug, tx);
      if (changes.bookingEnabled === true) {
        const missing = missingFrom(readiness);
        if (missing.length > 0) throw new BookingNotReadyError(missing);
      }

      let updated: Settings;
      try {
        updated = await bookingSettingsRepository.updateSettings(userId, changes, tx);
      } catch (err) {
        if (isPrismaUniqueConstraintError(err)) throw new BookingSlugTakenError();
        throw err;
      }

      const diff = computeDiff(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, BOOKING_SETTINGS_DIFF_FIELDS);
      if (diff.affectedFields.length > 0) {
        await logAudit({
          entityType: EntityType.USER,
          entityId: userId,
          userId,
          actionType: ActionType.UPDATE,
          description: 'Configuración de reserva en línea actualizada',
          ...diff,
          tx,
          required: true,
        });
      }
      return toResponse(updated, readiness);
    });
    logger.info({ userId, fields: Object.keys(dto) }, 'Booking settings updated');
    return result;
  },

  /**
   * Whether the provider's public booking link accepts bookings right now. The single check for every
   * public slot/booking endpoint: call it inside the booking transaction after `withProviderLock`, and
   * answer as for an unknown slug when it is false.
   */
  async isBookingLive(userId: string, tx?: TransactionClient): Promise<boolean> {
    if (!config.portal.patientEnabled) return false;
    const state = await bookingSettingsRepository.getBookingState(userId, tx);
    if (!state || state.status !== AdminStatus.ACTIVE || state.deletedAt !== null || !state.bookingEnabled) return false;
    return isReady(await bookingSettingsRepository.getReadiness(userId, state.bookingSlug, tx));
  },

  async suggestSlug(userId: string): Promise<{ slug: string | null }> {
    const user = await bookingSettingsRepository.getSlugSources(userId);
    const base = user.displayName?.trim() || [ user.firstName, user.lastName ].filter(Boolean).join(' ') || 'consulta';
    const slug = await suggestSlug(base, (candidate) => bookingSettingsRepository.isSlugTakenByOther(candidate, userId));
    return { slug };
  },

  async getAvailability(userId: string) {
    const [ settings, rules ] = await Promise.all([
      bookingSettingsRepository.getSettings(userId),
      bookingSettingsRepository.listRules(userId),
    ]);
    return { timezone: settings.timezone, rules: rules.map(toRuleView) };
  },

  async replaceAvailability(userId: string, dto: ReplaceAvailabilityDto) {
    const result = await prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const settings = await bookingSettingsRepository.getSettings(userId, tx);
      if (settings.bookingEnabled && dto.rules.length === 0) throw new BookingAvailabilityRequiredError();

      const before = (await bookingSettingsRepository.listRules(userId, tx)).map(toRuleView);
      const after = (await bookingSettingsRepository.replaceRules(userId, dto.rules, tx)).map(toRuleView);

      if (JSON.stringify(before) !== JSON.stringify(after)) {
        await logAudit({
          entityType: EntityType.USER,
          entityId: userId,
          userId,
          actionType: ActionType.UPDATE,
          description: 'Disponibilidad semanal actualizada',
          affectedFields: [ 'availability' ],
          fieldsBefore: { availability: before },
          fieldsAfter: { availability: after },
          tx,
          required: true,
        });
      }
      return { timezone: settings.timezone, rules: after };
    });
    logger.info({ userId, rules: dto.rules.length }, 'Availability replaced');
    return result;
  },
};
