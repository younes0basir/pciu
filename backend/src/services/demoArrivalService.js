const { query, withTransaction } = require('../config/db');

const DEMO_SOURCE = 'seedRandomArrivals';
const BATCH_SIZE = 10;

const FIRST_NAMES = [
  'Amina',
  'Youssef',
  'Sara',
  'Mehdi',
  'Fatima',
  'Omar',
  'Leila',
  'Karim',
  'Nadia',
  'Hassan',
  'Imane',
  'Rachid',
  'Salma',
  'Anas',
  'Khadija',
];

const LAST_NAMES = [
  'Bennani',
  'El Amrani',
  'Tazi',
  'Alaoui',
  'Idrissi',
  'Chraibi',
  'Berrada',
  'Fassi',
  'Squalli',
  'Kettani',
  'Ouazzani',
  'Benjelloun',
  'Lahlou',
  'Mansouri',
  'Zahraoui',
];

const COMPLAINTS = [
  'Douleur thoracique',
  'Traumatisme crânien',
  'Fièvre et toux',
  'Douleur abdominale',
  'Essoufflement',
  'Plaie de la main',
  'Malaise',
  'Céphalées intenses',
  'Vomissements',
  'Douleur lombaire',
];

const ARRIVAL_MODES = ['À pied', 'Ambulance', 'Brancard', 'Autre'];
const SEXES = ['female', 'male'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDigits(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += Math.floor(Math.random() * 10);
  }
  return out;
}

function publicCode() {
  let rand = '';
  for (let i = 0; i < 4; i += 1) {
    rand += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `V-${dateStr}-${rand}`;
}

function birthDate() {
  const age = 18 + Math.floor(Math.random() * 60);
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - age);
  date.setUTCMonth(Math.floor(Math.random() * 12));
  date.setUTCDate(1 + Math.floor(Math.random() * 28));
  return date.toISOString().slice(0, 10);
}

function buildBatchPayload(arrivedAt) {
  const stamp = arrivedAt.getTime();
  const firstNames = [];
  const lastNames = [];
  const nationalIds = [];
  const phones = [];
  const birthDates = [];
  const sexes = [];
  const publicCodes = [];
  const priorities = [];
  const complaints = [];
  const modes = [];

  for (let n = 1; n <= BATCH_SIZE; n += 1) {
    firstNames.push(pick(FIRST_NAMES));
    lastNames.push(pick(LAST_NAMES));
    nationalIds.push(`BK${stamp}${String(n).padStart(2, '0')}`);
    phones.push(`06${randomDigits(8)}`);
    birthDates.push(birthDate());
    sexes.push(pick(SEXES));
    publicCodes.push(publicCode());
    priorities.push(1 + Math.floor(Math.random() * 5));
    complaints.push(pick(COMPLAINTS));
    modes.push(pick(ARRIVAL_MODES));
  }

  return {
    firstNames,
    lastNames,
    nationalIds,
    phones,
    birthDates,
    sexes,
    publicCodes,
    priorities,
    complaints,
    modes,
  };
}

async function countDemoArrivals() {
  const result = await query(
    `SELECT
       COUNT(*)::int AS visits,
       COUNT(*) FILTER (WHERE v.status = 'waiting')::int AS waiting
     FROM visits v
     WHERE EXISTS (
       SELECT 1
       FROM visit_events e
       WHERE e.visit_id = v.id
         AND e.event_type = 'registered'
         AND e.metadata->>'source' = $1
     )`,
    [DEMO_SOURCE],
  );

  const row = result.rows[0];
  return {
    visits: row.visits,
    waiting: row.waiting,
  };
}

async function createDemoArrivals(actorUser) {
  const arrivedAt = new Date();
  const batch = buildBatchPayload(arrivedAt);

  return withTransaction(async (client) => {
    const patients = await client.query(
      `INSERT INTO patients (first_name, last_name, national_id, phone, birth_date, sex)
       SELECT *
       FROM UNNEST(
         $1::text[],
         $2::text[],
         $3::text[],
         $4::text[],
         $5::date[],
         $6::text[]
       ) AS t(first_name, last_name, national_id, phone, birth_date, sex)
       RETURNING id`,
      [
        batch.firstNames,
        batch.lastNames,
        batch.nationalIds,
        batch.phones,
        batch.birthDates,
        batch.sexes,
      ],
    );

    const patientIds = patients.rows.map((row) => row.id);

    const visits = await client.query(
      `INSERT INTO visits (
         public_code,
         patient_id,
         status,
         care_stage,
         patient_location,
         priority,
         chief_complaint,
         arrival_mode,
         arrived_at,
         registered_by
       )
       SELECT *
       FROM UNNEST(
         $1::text[],
         $2::bigint[],
         $3::text[],
         $4::text[],
         $5::text[],
         $6::smallint[],
         $7::text[],
         $8::text[],
         $9::timestamptz[],
         $10::bigint[]
       ) AS t(
         public_code,
         patient_id,
         status,
         care_stage,
         patient_location,
         priority,
         chief_complaint,
         arrival_mode,
         arrived_at,
         registered_by
       )
       RETURNING id, public_code, priority, chief_complaint`,
      [
        batch.publicCodes,
        patientIds,
        Array(BATCH_SIZE).fill('waiting'),
        Array(BATCH_SIZE).fill('triage_pending'),
        Array(BATCH_SIZE).fill('waiting_area'),
        batch.priorities,
        batch.complaints,
        batch.modes,
        Array(BATCH_SIZE).fill(arrivedAt),
        Array(BATCH_SIZE).fill(actorUser?.id || null),
      ],
    );

    const visitIds = visits.rows.map((row) => row.id);

    await client.query(
      `INSERT INTO visit_events (
         visit_id,
         actor_user_id,
         actor_type,
         event_type,
         from_status,
         to_status,
         metadata
       )
       SELECT
         t.visit_id,
         $2,
         'user',
         'registered',
         NULL,
         'waiting',
         jsonb_build_object(
           'priority', t.priority,
           'chiefComplaint', t.complaint,
           'arrivalMode', t.mode,
           'source', $3::text
         )
       FROM UNNEST(
         $1::bigint[],
         $4::int[],
         $5::text[],
         $6::text[]
       ) AS t(visit_id, priority, complaint, mode)`,
      [visitIds, actorUser?.id || null, DEMO_SOURCE, batch.priorities, batch.complaints, batch.modes],
    );

    const created = visits.rows.map((row, index) => ({
      visitId: Number(row.id),
      publicCode: row.public_code,
      patientName: `${batch.firstNames[index]} ${batch.lastNames[index]}`,
      priority: Number(row.priority),
      chiefComplaint: row.chief_complaint,
    }));

    return {
      created: created.length,
      arrivedAt: arrivedAt.toISOString(),
      visits: created,
    };
  });
}

async function deleteChildRowsForVisits(client, visitIds) {
  await client.query('DELETE FROM exams WHERE visit_id = ANY($1::bigint[])', [visitIds]);
  await client.query('DELETE FROM care_tasks WHERE visit_id = ANY($1::bigint[])', [visitIds]);
  await client.query(
    'DELETE FROM triage_assessments WHERE visit_id = ANY($1::bigint[])',
    [visitIds],
  );
  await client.query('DELETE FROM consultations WHERE visit_id = ANY($1::bigint[])', [visitIds]);
  await client.query('DELETE FROM bed_assignments WHERE visit_id = ANY($1::bigint[])', [visitIds]);
  await client.query('DELETE FROM visit_events WHERE visit_id = ANY($1::bigint[])', [visitIds]);
}

async function deleteDemoArrivals() {
  return withTransaction(async (client) => {
    const tagged = await client.query(
      `SELECT v.id AS visit_id, v.patient_id
       FROM visits v
       WHERE EXISTS (
         SELECT 1
         FROM visit_events e
         WHERE e.visit_id = v.id
           AND e.event_type = 'registered'
           AND e.metadata->>'source' = $1
       )
       FOR UPDATE`,
      [DEMO_SOURCE],
    );

    if (tagged.rowCount === 0) {
      return { visitsDeleted: 0, patientsDeleted: 0 };
    }

    const visitIds = tagged.rows.map((row) => row.visit_id);
    const patientIds = [...new Set(tagged.rows.map((row) => row.patient_id))];

    await deleteChildRowsForVisits(client, visitIds);

    const visits = await client.query('DELETE FROM visits WHERE id = ANY($1::bigint[])', [visitIds]);
    const patients = await client.query(
      `DELETE FROM patients p
       WHERE p.id = ANY($1::bigint[])
         AND NOT EXISTS (
           SELECT 1 FROM visits v WHERE v.patient_id = p.id
         )`,
      [patientIds],
    );

    return {
      visitsDeleted: visits.rowCount,
      patientsDeleted: patients.rowCount,
    };
  });
}

module.exports = {
  DEMO_SOURCE,
  countDemoArrivals,
  createDemoArrivals,
  deleteDemoArrivals,
};
