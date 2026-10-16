require('dotenv').config();
const { pool, withTransaction } = require('../config/db');
const { syncAdminFromEnv } = require('../services/adminBootstrap');
const {
  defaultDemoPasswordHash,
  seedDemoStaff,
  seedInfrastructure,
} = require('../services/seedDataService');

async function seed() {
  console.log('--- Starting Database Seed on neondb ---');
  const passwordHash = await defaultDemoPasswordHash();

  await withTransaction(async (client) => {
    console.log('Seeding users...');
    await seedDemoStaff(client, passwordHash);

    console.log('Seeding zones, rooms, and beds...');
    await seedInfrastructure(client);
  });

  const adminSync = await syncAdminFromEnv();
  if (adminSync.synced) {
    console.log(`✔ Admin synced from ADMIN_* env (${adminSync.email})`);
  } else {
    console.log('ℹ Admin not seeded — set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
  }

  console.log('✔ Database seeded successfully!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
