import type { AvailabilityRule } from '../../generated/prisma/client.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { UserNotFoundError } from '../utils/errors/errors.js';
import { buildUpdateData } from '../utils/prisma/build-update-data.js';
import type { AvailabilityRuleDto, UpdateBookingSettingsDto } from './booking-settings.schemas.js';

export const bookingSettingsSelect = {
  timezone: true,
  bookingSlug: true,
  bookingEnabled: true,
  bookingApprovalMode: true,
  slotIntervalMinutes: true,
  bufferMinutes: true,
  minLeadMinutes: true,
  maxHorizonDays: true,
  maxPatientReschedules: true,
  minRescheduleNoticeHours: true,
  portalReminderEnabled: true,
  portalReminderLeadHours: true,
  bio: true,
  specialty: true,
  publicPhone: true,
  publicWhatsapp: true,
  legalName: true,
  privacyContact: true,
  contactHours: true,
} as const;

/** Whether a portal appointment gets a reminder, and how many hours before its start. */
export interface PortalReminderPolicy {
  portalReminderEnabled: boolean;
  portalReminderLeadHours: number;
}

export interface BookingReadiness {
  hasSlug: boolean;
  hasLegalIdentity: boolean;
  hasAvailability: boolean;
  hasBookableType: boolean;
  hasBookableLocation: boolean;
}

export const bookingSettingsRepository = {
  async getSettings(userId: string, tx?: TransactionClient) {
    const settings = await (tx ?? prisma).user.findUnique({ where: { id: userId }, select: bookingSettingsSelect });
    if (!settings) throw new UserNotFoundError(userId);
    return settings;
  },

  async updateSettings(userId: string, dto: UpdateBookingSettingsDto, tx?: TransactionClient) {
    const data = buildUpdateData(
      dto,
      [
        'bookingSlug', 'bookingEnabled', 'bookingApprovalMode', 'slotIntervalMinutes', 'bufferMinutes', 'minLeadMinutes', 'maxHorizonDays',
        'maxPatientReschedules', 'minRescheduleNoticeHours', 'portalReminderEnabled', 'portalReminderLeadHours',
        'bio', 'specialty', 'publicPhone', 'publicWhatsapp', 'legalName', 'privacyContact', 'contactHours',
      ],
    );
    return (tx ?? prisma).user.update({ where: { id: userId }, data, select: bookingSettingsSelect });
  },

  async getPortalReminderPolicy(userId: string, tx: TransactionClient): Promise<PortalReminderPolicy> {
    const policy = await tx.user.findUnique({
      where: { id: userId },
      select: { portalReminderEnabled: true, portalReminderLeadHours: true },
    });
    if (!policy) throw new UserNotFoundError(userId);
    return policy;
  },

  async getBookingState(userId: string, tx?: TransactionClient) {
    return (tx ?? prisma).user.findUnique({
      where: { id: userId },
      select: { status: true, deletedAt: true, bookingEnabled: true, bookingSlug: true },
    });
  },

  async getSlugSources(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, firstName: true, lastName: true, bookingSlug: true },
    });
    if (!user) throw new UserNotFoundError(userId);
    return user;
  },

  async isSlugTakenByOther(slug: string, userId: string): Promise<boolean> {
    const owner = await prisma.user.findUnique({ where: { bookingSlug: slug }, select: { id: true } });
    return owner !== null && owner.id !== userId;
  },

  async getReadiness(userId: string, slug: string | null, tx?: TransactionClient): Promise<BookingReadiness> {
    const client = tx ?? prisma;
    const [ identity, rules, types, locations ] = await Promise.all([
      client.user.findUnique({
        where: { id: userId },
        select: { legalName: true, privacyContact: true, contactHours: true, publicPhone: true, publicWhatsapp: true },
      }),
      client.availabilityRule.count({ where: { userId } }),
      client.appointmentType.count({ where: { userId, bookableOnline: true, isActive: true, isDeleted: false } }),
      client.appointmentLocation.count({ where: { userId, bookableOnline: true, isActive: true, isDeleted: false } }),
    ]);
    return {
      hasSlug: slug !== null,
      // The alternative to the portal is what makes it voluntary, so a way to reach the clinic is part of this.
      hasLegalIdentity: !!(identity?.legalName && identity.privacyContact && identity.contactHours && (identity.publicPhone || identity.publicWhatsapp)),
      hasAvailability: rules > 0,
      hasBookableType: types > 0,
      hasBookableLocation: locations > 0,
    };
  },

  async listRules(userId: string, tx?: TransactionClient): Promise<AvailabilityRule[]> {
    return (tx ?? prisma).availabilityRule.findMany({
      where: { userId },
      orderBy: [ { weekday: 'asc' }, { startMinute: 'asc' } ],
    });
  },

  async replaceRules(userId: string, rules: AvailabilityRuleDto[], tx: TransactionClient): Promise<AvailabilityRule[]> {
    await tx.availabilityRule.deleteMany({ where: { userId } });
    if (rules.length > 0) {
      await tx.availabilityRule.createMany({
        data: rules.map((r) => ({ userId, weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute })),
      });
    }
    return bookingSettingsRepository.listRules(userId, tx);
  },
};
