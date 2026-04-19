import { prisma } from './prismaClient.js';
import {
    PatientStatus,
    Channel,
    ReminderStatus,
    ReminderMode,
    AppointmentStatus,
    AdminRole,
    AdminStatus,
} from '@prisma/client';

async function seed() {
    console.log('🌱 Seeding database...');

    if (process.env.NODE_ENV === 'production') {
        console.error('⛔ Seeding should not be run in production!');
        process.exit(1);
    }

    try {
        // ─── Clean up existing data ───────────────────────────────────────────────
        console.log('🗑️  Cleaning up existing test data...');
        await prisma.reminder.deleteMany({});
        await prisma.appointment.deleteMany({});
        await prisma.patient.deleteMany({});
        // Don't delete users to preserve admin accounts

        // ─── Get or create a user ─────────────────────────────────────────────────
        let user = await prisma.user.findUnique({
            where: { email: 'admin@example.com' },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: 'admin@example.com',
                    passwordHash: 'hashed_password_placeholder',
                    firstName: 'Admin',
                    lastName: 'User',
                    role: AdminRole.ADMIN,
                    status: AdminStatus.ACTIVE,
                },
            });
            console.log('✅ Created test admin user');
        }

        // ─── Seed Patients ───────────────────────────────────────────────────────
        console.log('👥 Creating test patients...');
        const patients = await Promise.all([
            prisma.patient.create({
                data: {
                    name: 'Juan',
                    lastName: 'Pérez',
                    whatsappNumber: '+1-555-0101',
                    smsNumber: '+1-555-0101',
                    email: 'juan.perez@example.com',
                    notes: 'Regular patient, prefers WhatsApp',
                    status: PatientStatus.ACTIVE,
                    userId: user.id,
                },
            }),
            prisma.patient.create({
                data: {
                    name: 'María',
                    lastName: 'García',
                    whatsappNumber: '+1-555-0102',
                    smsNumber: '+1-555-0102',
                    email: 'maria.garcia@example.com',
                    notes: 'Prefers SMS notifications',
                    status: PatientStatus.ACTIVE,
                    userId: user.id,
                },
            }),
            prisma.patient.create({
                data: {
                    name: 'Carlos',
                    lastName: 'López',
                    whatsappNumber: '+1-555-0103',
                    email: 'carlos.lopez@example.com',
                    notes: 'Email and WhatsApp preferred',
                    status: PatientStatus.ACTIVE,
                    userId: user.id,
                },
            }),
            prisma.patient.create({
                data: {
                    name: 'Sofia',
                    lastName: 'Martínez',
                    whatsappNumber: '+1-555-0104',
                    smsNumber: '+1-555-0104',
                    email: 'sofia.martinez@example.com',
                    status: PatientStatus.ACTIVE,
                    userId: user.id,
                },
            }),
        ]);

        console.log(`✅ Created ${patients.length} test patients`);

        // ─── Seed Default Locations & Types ──────────────────────────────────────
        console.log('📍 Creating default appointment locations...');
        await prisma.appointmentLocation.deleteMany({ where: { userId: user.id } });
        const locations = await Promise.all([
            prisma.appointmentLocation.create({
                data: { name: 'ACTA', address: null, isVirtual: false, color: '#2563EB', icon: '🏢', userId: user.id },
            }),
            prisma.appointmentLocation.create({
                data: { name: 'Sentido y Realidad', address: null, isVirtual: false, color: '#059669', icon: '🧠', userId: user.id },
            }),
            prisma.appointmentLocation.create({
                data: { name: 'Vamos a Terapia', address: null, isVirtual: false, color: '#D97706', icon: '💬', userId: user.id },
            }),
            prisma.appointmentLocation.create({
                data: { name: 'Virtual', isVirtual: true, color: '#7C3AED', icon: '💻', userId: user.id },
            }),
        ]);
        console.log(`✅ Created ${locations.length} default locations`);

        console.log('🧠 Creating default appointment types...');
        await prisma.appointmentType.deleteMany({ where: { userId: user.id } });
        const types = await Promise.all([
            prisma.appointmentType.create({
                data: { name: 'Individual', defaultDuration: 60, defaultPrice: 115000, color: '#2563EB', icon: '🧑', userId: user.id },
            }),
            prisma.appointmentType.create({
                data: { name: 'Niño', defaultDuration: 60, defaultPrice: 115000, color: '#059669', icon: '👶', userId: user.id },
            }),
            prisma.appointmentType.create({
                data: { name: 'Pareja', defaultDuration: 60, defaultPrice: 220000, color: '#D97706', icon: '👫', userId: user.id },
            }),
            prisma.appointmentType.create({
                data: { name: 'Familia', defaultDuration: 60, defaultPrice: 220000, color: '#7C3AED', icon: '👨‍👩‍👧‍👦', userId: user.id },
            }),
        ]);
        console.log(`✅ Created ${types.length} default appointment types`);

        // ─── Seed Appointments ────────────────────────────────────────────────────
        console.log('📅 Creating test appointments...');
        const now = new Date();
        const futureDate1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const futureDate2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
        const futureDate3 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days

        const appointments = await Promise.all([
            prisma.appointment.create({
                data: {
                    startAt: futureDate1,
                    endAt: new Date(futureDate1.getTime() + 60 * 60 * 1000),
                    timezone: 'America/New_York',
                    price: 115000,
                    currency: 'COP',
                    paid: false,
                    notes: 'Initial consultation',
                    status: AppointmentStatus.SCHEDULED,
                    patientId: patients[ 0 ].id,
                    locationId: locations[ 0 ].id,
                    typeId: types[ 0 ].id,
                },
            }),
            prisma.appointment.create({
                data: {
                    startAt: futureDate2,
                    endAt: new Date(futureDate2.getTime() + 45 * 60 * 1000),
                    timezone: 'America/New_York',
                    price: 115000,
                    currency: 'COP',
                    paid: true,
                    meetingUrl: 'https://meet.example.com/session-123',
                    status: AppointmentStatus.CONFIRMED,
                    patientId: patients[ 1 ].id,
                    locationId: locations[ 3 ].id,
                    typeId: types[ 0 ].id,
                },
            }),
            prisma.appointment.create({
                data: {
                    startAt: futureDate3,
                    endAt: new Date(futureDate3.getTime() + 30 * 60 * 1000),
                    timezone: 'America/New_York',
                    price: 115000,
                    currency: 'COP',
                    paid: false,
                    notes: 'Routine check-up',
                    status: AppointmentStatus.SCHEDULED,
                    patientId: patients[ 2 ].id,
                    locationId: locations[ 1 ].id,
                    typeId: types[ 0 ].id,
                },
            }),
            prisma.appointment.create({
                data: {
                    startAt: futureDate1,
                    endAt: new Date(futureDate1.getTime() + 90 * 60 * 1000),
                    timezone: 'America/New_York',
                    price: 220000,
                    currency: 'COP',
                    paid: true,
                    notes: 'Pre-surgery assessment',
                    status: AppointmentStatus.CONFIRMED,
                    patientId: patients[ 3 ].id,
                    locationId: locations[ 2 ].id,
                    typeId: types[ 2 ].id,
                },
            }),
        ]);

        console.log(`✅ Created ${appointments.length} test appointments`);

        // ─── Seed Reminders ──────────────────────────────────────────────────────
        console.log('🔔 Creating test reminders...');
        const reminderDate1 = new Date(futureDate1.getTime() - 24 * 60 * 60 * 1000); // 1 day before
        const reminderDate2 = new Date(futureDate2.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
        const reminderDate3 = new Date(futureDate3.getTime() - 60 * 60 * 1000); // 1 hour before

        const reminders = await Promise.all([
            prisma.reminder.create({
                data: {
                    channel: Channel.WHATSAPP,
                    to: patients[ 0 ].whatsappNumber!,
                    body: `Reminder: You have an appointment on ${futureDate1.toLocaleDateString()} at ${futureDate1.toLocaleTimeString()}`,
                    status: ReminderStatus.PENDING,
                    sendMode: ReminderMode.SCHEDULED,
                    sendAt: reminderDate1,
                    appointmentId: appointments[ 0 ].id,
                    patientId: patients[ 0 ].id,
                },
            }),
            prisma.reminder.create({
                data: {
                    channel: Channel.SMS,
                    to: patients[ 1 ].smsNumber!,
                    body: 'Your appointment is coming up in 2 hours. Please confirm your attendance.',
                    status: ReminderStatus.SENT,
                    sentAt: new Date(),
                    sendMode: ReminderMode.SCHEDULED,
                    sendAt: reminderDate2,
                    messageId: 'msg_12345',
                    appointmentId: appointments[ 1 ].id,
                    patientId: patients[ 1 ].id,
                },
            }),
            prisma.reminder.create({
                data: {
                    channel: Channel.EMAIL,
                    to: patients[ 2 ].email!,
                    body: 'Appointment reminder: You have a check-up scheduled for today.',
                    status: ReminderStatus.PENDING,
                    sendMode: ReminderMode.SCHEDULED,
                    sendAt: reminderDate3,
                    appointmentId: appointments[ 2 ].id,
                    patientId: patients[ 2 ].id,
                },
            }),
            prisma.reminder.create({
                data: {
                    channel: Channel.WHATSAPP,
                    to: patients[ 3 ].whatsappNumber!,
                    body: 'Important: Your surgery consultation is tomorrow. Please arrive 15 minutes early.',
                    status: ReminderStatus.FAILED,
                    error: 'Invalid phone number format',
                    sendMode: ReminderMode.SCHEDULED,
                    sendAt: reminderDate1,
                    appointmentId: appointments[ 3 ].id,
                    patientId: patients[ 3 ].id,
                },
            }),
            // Reminder without appointment (standalone reminder)
            prisma.reminder.create({
                data: {
                    channel: Channel.SMS,
                    to: patients[ 0 ].smsNumber!,
                    body: 'Medication reminder: Take your daily medication',
                    status: ReminderStatus.QUEUED,
                    sendMode: ReminderMode.SCHEDULED,
                    sendAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
                    patientId: patients[ 0 ].id,
                },
            }),
        ]);

        console.log(`✅ Created ${reminders.length} test reminders`);

        // ─── Summary ──────────────────────────────────────────────────────────────
        console.log('\n✨ Database seeding completed successfully!');
        console.log('\n📊 Seeded Data Summary:');
        console.log(`   • Users: 1`);
        console.log(`   • Patients: ${patients.length}`);
        console.log(`   • Locations: ${locations.length}`);
        console.log(`   • Appointment Types: ${types.length}`);
        console.log(`   • Appointments: ${appointments.length}`);
        console.log(`   • Reminders: ${reminders.length}`);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

seed()
    .catch(console.error)
    .finally(() => process.exit(0));
