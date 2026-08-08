import argon2 from 'argon2';
import { prisma } from './prisma-client.js';
import { config } from '../config/config.js';
import { AdminRole, AdminStatus, Channel } from '../../../generated/prisma/client.ts';

async function seedAdmin() {
  const email = config.admin.email;
  const password = config.admin.password;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin user already exists — skipping.');
    return;
  }

  const passwordHash = await argon2.hash(password, {
    memoryCost: config.auth.argon2Memory,
    timeCost: config.auth.argon2Iterations,
    parallelism: config.auth.argon2Parallelism,
  });
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      reminderChannel: Channel.WHATSAPP
    },
  });

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
