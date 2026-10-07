require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../config/db');
const { syncAdminFromEnv } = require('../services/adminBootstrap');

async function seed() {
  console.log('--- Starting Database Seed on neondb ---');
  const passwordHash = await bcrypt.hash('password123', 10);

  await withTransaction(async (client) => {
    // 1. Seed demo staff (admin is provisioned from ADMIN_* env — see backend/.env.example)
    const users = [
      { firstName: 'Yassine', lastName: 'Accueil', email: 'receptionist@chu.ma', role: 'receptionist' },
      { firstName: 'Sara', lastName: 'Infirmière', email: 'nurse@chu.ma', role: 'nurse' },
      { firstName: 'Dr. Mehdi', lastName: 'Médecin', email: 'doctor@chu.ma', role: 'doctor' },
      { firstName: 'Dr. Amina', lastName: 'Chef', email: 'chief@chu.ma', role: 'chief' },
    ];

    console.log('Seeding users...');
    for (const u of users) {
      await client.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT ((lower(email))) DO UPDATE 
         SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role`,
        [u.firstName, u.lastName, u.email, passwordHash, u.role]
      );
    }

    // 2. Seed Zones, Rooms, and Beds
    console.log('Seeding zones, rooms, and beds...');
    const zones = [
      {
        name: 'Déchoquage / SAUV',
        color: '#EF4444',
        order: 1,
        rooms: [
          { name: 'Salle SAUV 1', order: 1, beds: ['Lit D1', 'Lit D2'] },
          { name: 'Salle SAUV 2', order: 2, beds: ['Lit D3'] },
        ],
      },
      {
        name: 'Surveillance Rapide',
        color: '#F59E0B',
        order: 2,
        rooms: [
          { name: 'Box A', order: 1, beds: ['Lit A1', 'Lit A2'] },
          { name: 'Box B', order: 2, beds: ['Lit B1', 'Lit B2'] },
        ],
      },
      {
        name: 'Soins Ambulatoires',
        color: '#10B981',
        order: 3,
        rooms: [
          { name: 'Secteur Ambulatoire', order: 1, beds: ['Fauteuil 1', 'Fauteuil 2', 'Fauteuil 3'] },
        ],
      },
    ];

    for (const z of zones) {
      const zoneRes = await client.query(
        `INSERT INTO zones (name, color, display_order, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color, display_order = EXCLUDED.display_order
         RETURNING id`,
        [z.name, z.color, z.order]
      );
      const zoneId = zoneRes.rows[0].id;

      for (const r of z.rooms) {
        const roomRes = await client.query(
          `INSERT INTO rooms (zone_id, name, display_order, is_active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (zone_id, name) DO UPDATE SET display_order = EXCLUDED.display_order
           RETURNING id`,
          [zoneId, r.name, r.order]
        );
        const roomId = roomRes.rows[0].id;

        for (let i = 0; i < r.beds.length; i++) {
          const bedLabel = r.beds[i];
          await client.query(
            `INSERT INTO beds (room_id, label, display_order, is_active)
             VALUES ($1, $2, $3, true)
             ON CONFLICT (room_id, label) DO NOTHING`,
            [roomId, bedLabel, i + 1]
          );
        }
      }
    }
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
