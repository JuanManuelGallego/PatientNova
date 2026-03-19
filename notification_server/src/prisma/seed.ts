/**
 * Seed script — populates DB with sample data for all models.
 * Run with: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Patients ──────────────────────────────────────────────────────────────
  console.log('👤 Patients...');
  const patients = await Promise.all([
    prisma.patient.upsert({
      where: { email: 'maria.garcia@example.com' },
      update: {},
      create: { name: 'María', lastName: 'García', email: 'maria.garcia@example.com', whatsappNumber: '+15551110001', smsNumber: '+15551110001', status: 'ACTIVE' },
    }),
    prisma.patient.upsert({
      where: { email: 'carlos.lopez@example.com' },
      update: {},
      create: { name: 'Carlos', lastName: 'López', email: 'carlos.lopez@example.com', whatsappNumber: '+15551110002', smsNumber: null, status: 'ACTIVE' },
    }),
    prisma.patient.upsert({
      where: { email: 'sofia.martinez@example.com' },
      update: {},
      create: { name: 'Sofía', lastName: 'Martínez', email: 'sofia.martinez@example.com', whatsappNumber: null, smsNumber: '+15551110003', status: 'ACTIVE' },
    }),
    prisma.patient.upsert({
      where: { email: 'andres.rodriguez@example.com' },
      update: {},
      create: { name: 'Andrés', lastName: 'Rodríguez', email: 'andres.rodriguez@example.com', whatsappNumber: '+15551110004', smsNumber: '+15551110004', status: 'INACTIVE' },
    }),
  ]);
  patients.forEach(p => console.log(`  ✓ ${p.name} ${p.lastName}`));

  // ── Reminders ────────────────────────────────────────────────────────────
  console.log('\n🔔 Reminders...');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

  const reminders = await Promise.all([
    prisma.reminder.create({
      data: {
        channel: 'WHATSAPP', to: '+15551110001', mode: 'SCHEDULED',
        status: 'PENDING', sentAt: tomorrow, scheduledAt: tomorrow,
      },
    }),
    prisma.reminder.create({
      data: {
        channel: 'SMS', to: '+15551110003', mode: 'SCHEDULED',
        status: 'PENDING', sentAt: nextWeek, scheduledAt: nextWeek,
      },
    }),
    prisma.reminder.create({
      data: {
        channel: 'WHATSAPP', to: '+15551110002', mode: 'IMMEDIATE',
        status: 'SENT', sentAt: yesterday,
      },
    }),
    prisma.reminder.create({
      data: {
        channel: 'SMS', to: '+15551110004', mode: 'IMMEDIATE',
        status: 'FAILED', sentAt: yesterday, error: 'Invalid destination number',
      },
    }),
  ]);
  reminders.forEach(r => console.log(`  ✓ ${r.channel} → ${r.to} [${r.status}]`));

  // ── Appointments ──────────────────────────────────────────────────────────
  console.log('\n📅 Appointments...');
  const appts = await Promise.all([
    prisma.appointment.create({
      data: {
        patientId: patients[ 0 ].id, reminderId: reminders[ 0 ].id,
        date: '2026-04-10', time: '09:00', type: 'Revisión General',
        location: 'Consultorio 3, Clínica Central', price: '150.00',
        payed: true, duration: '30 min', status: 'CONFIRMED',
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[ 1 ].id, reminderId: reminders[ 1 ].id,
        date: '2026-04-12', time: '11:00', type: 'Revisión de Análisis de Sangre',
        location: 'Laboratorio Norte', price: '80.00',
        payed: false, duration: '15 min', status: 'SCHEDULED',
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[ 2 ].id,
        date: '2026-04-14', time: '14:30', type: 'Consulta de Seguimiento',
        location: 'Telemedicina', meetingUrl: 'https://meet.example.com/room-xyz',
        price: '100.00', payed: false, duration: '45 min', status: 'SCHEDULED',
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[ 3 ].id,
        date: '2026-03-01', time: '10:00', type: 'Vacunación',
        location: 'Centro de Salud Sur', price: '60.00',
        payed: true, duration: '10 min', status: 'COMPLETED',
      },
    }),
  ]);
  appts.forEach(a => console.log(`  ✓ ${a.type} — ${a.date} ${a.time} [${a.status}]`));

  console.log(`\n✅ Seed complete: ${patients.length} patients, ${reminders.length} reminders, ${appts.length} appointments.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
