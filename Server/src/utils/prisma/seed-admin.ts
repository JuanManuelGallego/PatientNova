import bcrypt from 'bcrypt';
import { prisma } from './prisma-client.js';
import { config, requireEnv } from '../config/config.js';
import { AdminRole, AdminStatus, Channel } from '../../../generated/prisma/client.ts';
import { createUserWithDefaultType } from '../../patient-types/patient-type.repository.js';

async function seedAdmin() {
  // Seed-only credentials: the server never reads them, so production need not keep them in env.
  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin user already exists — skipping.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
  // The account and its default patient type ("General") in one transaction.
  await prisma.$transaction((tx) => createUserWithDefaultType(tx, (defaultPatientTypeId) => tx.user.create({
    data: {
      defaultPatientTypeId,
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      reminderChannel: Channel.WHATSAPP
    },
  })));

  console.log(`✅ Admin created: ${email}`);
  console.log('⚠️  Change the default password immediately after first login!');
}

seedAdmin()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(0));
  });
