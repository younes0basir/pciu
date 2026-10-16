const bcrypt = require('bcryptjs');

const DEMO_STAFF = [
  { firstName: 'Yassine', lastName: 'Accueil', email: 'receptionist@chu.ma', role: 'receptionist' },
  { firstName: 'Sara', lastName: 'Infirmière', email: 'nurse@chu.ma', role: 'nurse' },
  { firstName: 'Dr. Mehdi', lastName: 'Médecin', email: 'doctor@chu.ma', role: 'doctor' },
  { firstName: 'Dr. Amina', lastName: 'Chef', email: 'chief@chu.ma', role: 'chief' },
];

const DEMO_STAFF_EMAILS = DEMO_STAFF.map((u) => u.email.toLowerCase());

const DEFAULT_ZONES = [
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
    rooms: [{ name: 'Secteur Ambulatoire', order: 1, beds: ['Fauteuil 1', 'Fauteuil 2', 'Fauteuil 3'] }],
  },
];

async function seedDemoStaff(client, passwordHash) {
  for (const u of DEMO_STAFF) {
    await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, $5, true, false)
       ON CONFLICT ((lower(email))) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           role = EXCLUDED.role,
           password_hash = EXCLUDED.password_hash,
           must_change_password = false,
           is_active = true`,
      [u.firstName, u.lastName, u.email, passwordHash, u.role],
    );
  }
  return DEMO_STAFF.length;
}

async function seedInfrastructure(client) {
  let bedsSeeded = 0;
  for (const z of DEFAULT_ZONES) {
    const zoneRes = await client.query(
      `INSERT INTO zones (name, color, display_order, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color, display_order = EXCLUDED.display_order
       RETURNING id`,
      [z.name, z.color, z.order],
    );
    const zoneId = zoneRes.rows[0].id;

    for (const r of z.rooms) {
      const roomRes = await client.query(
        `INSERT INTO rooms (zone_id, name, display_order, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (zone_id, name) DO UPDATE SET display_order = EXCLUDED.display_order
         RETURNING id`,
        [zoneId, r.name, r.order],
      );
      const roomId = roomRes.rows[0].id;

      for (let i = 0; i < r.beds.length; i++) {
        const bedLabel = r.beds[i];
        const bedRes = await client.query(
          `INSERT INTO beds (room_id, label, display_order, is_active, operational_status)
           VALUES ($1, $2, $3, true, 'ready')
           ON CONFLICT (room_id, label) DO UPDATE SET display_order = EXCLUDED.display_order, is_active = true
           RETURNING id`,
          [roomId, bedLabel, i + 1],
        );
        if (bedRes.rowCount > 0) bedsSeeded += 1;
      }
    }
  }
  return { zones: DEFAULT_ZONES.length, bedsTouched: bedsSeeded };
}

async function defaultDemoPasswordHash() {
  return bcrypt.hash('password123', 10);
}

module.exports = {
  DEMO_STAFF,
  DEMO_STAFF_EMAILS,
  DEFAULT_ZONES,
  seedDemoStaff,
  seedInfrastructure,
  defaultDemoPasswordHash,
};
