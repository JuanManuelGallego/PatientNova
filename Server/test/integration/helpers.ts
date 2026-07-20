import { prisma } from '../../src/prisma/prismaClient.js';
import bcrypt from 'bcrypt';
import { config } from '../../src/utils/config.js';
import {
  Channel,
  PatientStatus,
  AdminRole,
  AdminStatus,
} from '../../generated/prisma/client.ts';

let seq = 0;
function unique(suffix: string): string {
  seq += 1;
  return `${suffix}-${Date.now()}-${seq}`;
}

export async function createTestUser(overrides: {
  email?: string;
  password?: string;
  role?: AdminRole;
  status?: AdminStatus;
} = {}) {
  const email = overrides.email ?? unique('user@test.local');
  const password = overrides.password ?? 'Password123!';
  const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      role: overrides.role ?? AdminRole.ADMIN,
      status: overrides.status ?? AdminStatus.ACTIVE,
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      reminderActive: false,
      reminderChannel: Channel.WHATSAPP,
      timezone: config.defaults.timezone,
    },
  });
}

export async function createTestPatient(
  userId: string,
  overrides: { name?: string; lastName?: string; email?: string } = {},
) {
  return prisma.patient.create({
    data: {
      name: overrides.name ?? 'Maria',
      lastName: overrides.lastName ?? 'Garcia',
      email: (overrides.email ?? unique('patient@test.local')).toLowerCase(),
      status: PatientStatus.ACTIVE,
      userId,
    },
  });
}

export async function createTestLocation(userId: string, overrides: { name?: string; isVirtual?: boolean } = {}) {
  return prisma.appointmentLocation.create({
    data: {
      name: overrides.name ?? unique('Office'),
      isVirtual: overrides.isVirtual ?? false,
      userId,
    },
  });
}

export async function createTestAppointmentType(userId: string, overrides: { name?: string } = {}) {
  return prisma.appointmentType.create({
    data: {
      name: overrides.name ?? unique('Consult'),
      defaultDuration: 60,
      userId,
    },
  });
}

export function futureDate(offsetMinutes = 60): Date {
  return new Date(Date.now() + offsetMinutes * 60_000);
}

export function appointmentTimeRange(offsetMinutes = 60, durationMinutes = 30) {
  const start = futureDate(offsetMinutes);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

export { unique };
