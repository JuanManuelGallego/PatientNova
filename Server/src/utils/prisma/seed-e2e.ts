import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { prisma } from './prisma-client.js';
import { maskEmail } from '../api/logger.js';
import { config } from '../config/config.js';
import { AdminRole, AdminStatus, Channel } from '../../../generated/prisma/client.ts';

/**
 * Deterministic data for the Playwright suite against a throwaway stack. The ids/names match the
 * APPT_TYPE_* / LOCATION_* variables in .github/workflows/ci.yml. Refuses to run unless the
 * database name contains "test" or "e2e" so it can never touch a real database.
 */
export const E2E_SEED = {
  appointmentTypeId: '00000000-0000-4000-8000-0000000000a1',
  appointmentTypeName: 'E2E Consulta',
  locationId: '00000000-0000-4000-8000-0000000000a2',
  locationName: 'E2E Consultorio',
  // A second provider whose online booking is live, for the public /book pages (Portal e2e `public` projects).
  publicProviderEmail: 'e2e-public-provider@example.com',
  publicSlug: 'e2e-publica',
  publicTypeId: '00000000-0000-4000-8000-0000000000b1',
  publicFollowUpTypeId: '00000000-0000-4000-8000-0000000000b3',
  publicLocationId: '00000000-0000-4000-8000-0000000000b2',
} as const;

// A complete profile unlocks UI flows that are gated on it (e.g. the patient welcome message).
const profile = {
  displayName: 'Dr. E2E',
  bankName: 'Banco E2E',
  accountNumber: '000111222',
  nationalId: '1000000001',
  bankingKey: 'e2e-banking-key',
} as const;

/** The database name only: user, password and host must not be able to satisfy the guard. */
function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
}

async function seedE2e() {
  if (!/(test|e2e)/i.test(databaseName(config.databaseUrl))) {
    throw new Error('Refusing to seed e2e data: the DATABASE_URL database name must contain "test" or "e2e".');
  }

  const email = config.admin.email;
  const passwordHash = await bcrypt.hash(config.admin.password, config.auth.bcryptRounds);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, status: AdminStatus.ACTIVE, failedLoginAttempts: 0, lockedUntil: null, ...profile },
    create: {
      email,
      passwordHash,
      firstName: 'E2E',
      lastName: 'Admin',
      ...profile,
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      reminderChannel: Channel.WHATSAPP,
    },
  });

  await prisma.appointmentType.upsert({
    where: { id: E2E_SEED.appointmentTypeId },
    update: { isDeleted: false, isActive: true, defaultPrice: 100000 },
    create: { id: E2E_SEED.appointmentTypeId, name: E2E_SEED.appointmentTypeName, defaultDuration: 60, defaultPrice: 100000, userId: user.id },
  });
  await prisma.appointmentLocation.upsert({
    where: { id: E2E_SEED.locationId },
    update: { isDeleted: false, isActive: true },
    create: { id: E2E_SEED.locationId, name: E2E_SEED.locationName, isVirtual: false, userId: user.id },
  });

  const content = Buffer.from('%PDF-1.4 e2e consent');
  await prisma.document.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, name: 'Consentimiento E2E.pdf', content, mimeType: 'application/pdf', sizeBytes: content.length },
  });

  await seedPublicProvider();

  console.log(`E2E seed ready for ${maskEmail(email)}`);
}

/** Never logs in (random password): it only backs the public booking page. Open 08:00-18:00 every day. */
async function seedPublicProvider() {
  const booking = { bookingSlug: E2E_SEED.publicSlug, bookingEnabled: true, slotIntervalMinutes: 60, bufferMinutes: 0, minLeadMinutes: 0, maxHorizonDays: 60 };
  const provider = await prisma.user.upsert({
    where: { email: E2E_SEED.publicProviderEmail },
    update: { status: AdminStatus.ACTIVE, deletedAt: null, isDeleted: false, ...booking },
    create: {
      email: E2E_SEED.publicProviderEmail,
      passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), config.auth.bcryptRounds),
      firstName: 'Ana',
      lastName: 'Pública',
      displayName: 'Dra. Ana Pública',
      jobTitle: 'Psicóloga',
      role: AdminRole.ADMIN,
      status: AdminStatus.ACTIVE,
      reminderChannel: Channel.EMAIL,
      ...booking,
    },
  });
  await prisma.availabilityRule.deleteMany({ where: { userId: provider.id } });
  await prisma.availabilityRule.createMany({
    data: [ 1, 2, 3, 4, 5, 6, 7 ].map((weekday) => ({ userId: provider.id, weekday, startMinute: 8 * 60, endMinute: 18 * 60 })),
  });
  await prisma.appointmentType.upsert({
    where: { id: E2E_SEED.publicTypeId },
    update: { isDeleted: false, isActive: true, bookableOnline: true },
    create: { id: E2E_SEED.publicTypeId, name: 'Primera consulta', defaultDuration: 60, defaultPrice: 150000, bookableOnline: true, userId: provider.id },
  });
  await prisma.appointmentType.upsert({
    where: { id: E2E_SEED.publicFollowUpTypeId },
    update: { isDeleted: false, isActive: true, bookableOnline: true },
    create: { id: E2E_SEED.publicFollowUpTypeId, name: 'Control', defaultDuration: 30, defaultPrice: 90000, bookableOnline: true, userId: provider.id },
  });
  await prisma.appointmentLocation.upsert({
    where: { id: E2E_SEED.publicLocationId },
    update: { isDeleted: false, isActive: true, bookableOnline: true },
    create: { id: E2E_SEED.publicLocationId, name: 'Consultorio Centro', address: 'Calle 10 # 5-20', bookableOnline: true, userId: provider.id },
  });
}

seedE2e()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
