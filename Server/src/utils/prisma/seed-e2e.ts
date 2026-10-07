import bcrypt from 'bcrypt';
import { prisma } from './prisma-client.js';
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
} as const;

// A complete profile unlocks UI flows that are gated on it (e.g. the patient welcome message).
const profile = {
  displayName: 'Dr. E2E',
  bankName: 'Banco E2E',
  accountNumber: '000111222',
  nationalId: '1000000001',
  bankingKey: 'e2e-banking-key',
} as const;

async function seedE2e() {
  if (!/(test|e2e)/i.test(config.databaseUrl)) {
    throw new Error('Refusing to seed e2e data: DATABASE_URL must contain "test" or "e2e".');
  }

  const email = config.admin.email;
  const passwordHash = await bcrypt.hash(config.admin.password, config.auth.bcryptRounds);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, status: AdminStatus.ACTIVE, ...profile },
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
    update: { isDeleted: false, isActive: true, defaultPrice: 100000 },
    create: { id: E2E_SEED.locationId, name: E2E_SEED.locationName, isVirtual: false, defaultPrice: 100000, userId: user.id },
  });

  const content = Buffer.from('%PDF-1.4 e2e consent');
  await prisma.document.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, name: 'Consentimiento E2E.pdf', content, mimeType: 'application/pdf', sizeBytes: content.length },
  });

  console.log(`E2E seed ready for ${email}`);
}

seedE2e()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
