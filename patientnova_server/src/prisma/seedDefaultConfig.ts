/**
 * One-time migration script: Seeds default appointment locations and types
 * for ALL existing users who don't have any yet.
 *
 * Safe to run multiple times — skips users that already have locations/types.
 *
 * Usage: npx tsx src/prisma/seedDefaultConfig.ts
 */

import { prisma } from './prismaClient.js';

const DEFAULT_LOCATIONS = [
    { name: 'ACTA', isVirtual: false, color: '#2563EB', icon: '🏢', bg: '#DBEAFE' , dot: '#3B82F6' },
    { name: 'Sentido y Realidad', isVirtual: false, color: '#059669', icon: '🧠', bg: '#D1FAE5', dot: '#10B981' },
    { name: 'Vamos a Terapia', isVirtual: false, color: '#D97706', icon: '💬', bg: '#FEF3C7', dot: '#F59E0B' },
    { name: 'Virtual', isVirtual: true, color: '#7C3AED', icon: '💻', bg: '#EDE9FE', dot: '#8B5CF6' },
];

const DEFAULT_TYPES = [
    { name: 'Individual', defaultDuration: 60, defaultPrice: 115000, color: '#2563EB', icon: '🧑' },
    { name: 'Niño', defaultDuration: 60, defaultPrice: 115000, color: '#059669', icon: '👶' },
    { name: 'Pareja', defaultDuration: 60, defaultPrice: 220000, color: '#D97706', icon: '👫' },
    { name: 'Familia', defaultDuration: 60, defaultPrice: 220000, color: '#7C3AED', icon: '👨‍👩‍👧‍👦' },
];

async function seedDefaultConfig() {
    console.log('🔧 Seeding default config for existing users...\n');

    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    console.log(`Found ${users.length} user(s)\n`);

    for (const user of users) {
        const existingLocations = await prisma.appointmentLocation.count({ where: { userId: user.id } });
        if (existingLocations === 0) {
            await Promise.all(
                DEFAULT_LOCATIONS.map(loc =>
                    prisma.appointmentLocation.create({ data: { ...loc, userId: user.id } })
                )
            );
            console.log(`  📍 ${user.email}: Created ${DEFAULT_LOCATIONS.length} locations`);
        } else {
            console.log(`  ⏭️  ${user.email}: Already has ${existingLocations} locations, skipping`);
        }

        const existingTypes = await prisma.appointmentType.count({ where: { userId: user.id } });
        if (existingTypes === 0) {
            await Promise.all(
                DEFAULT_TYPES.map(t =>
                    prisma.appointmentType.create({ data: { ...t, userId: user.id } })
                )
            );
            console.log(`  🧠 ${user.email}: Created ${DEFAULT_TYPES.length} types`);
        } else {
            console.log(`  ⏭️  ${user.email}: Already has ${existingTypes} types, skipping`);
        }
    }

    console.log('\n✅ Done!');
    await prisma.$disconnect();
}

seedDefaultConfig()
    .catch(err => { console.error('❌ Failed:', err); process.exit(1); })
    .finally(() => process.exit(0));
