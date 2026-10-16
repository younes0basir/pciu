/**
 * Tests V4 invariants (requires DATABASE_URL + migrate:v4 on isolated DB).
 * Run: npm run test:v4
 */
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, withTransaction } = require('../config/db');
const {
  assertBedAssignable,
  releaseBedToTurnover,
  setOperationalStatus,
} = require('../services/resourceService');

test('assertBedAssignable rejects cleaning bed', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }

  let bedId;
  await withTransaction(async (client) => {
    const bed = await client.query(
      `SELECT id FROM beds WHERE is_active = true ORDER BY id LIMIT 1 FOR UPDATE`,
    );
    if (bed.rowCount === 0) {
      t.skip('no beds');
      return;
    }
    bedId = bed.rows[0].id;
    await client.query(`UPDATE beds SET operational_status = 'cleaning' WHERE id = $1`, [bedId]);
  });

  if (!bedId) return;

  await assert.rejects(
    () =>
      withTransaction((client) => assertBedAssignable(client, bedId)),
    (err) => err.status === 409,
  );

  await pool.query(`UPDATE beds SET operational_status = 'ready' WHERE id = $1`, [bedId]);
});

test('releaseBedToTurnover sets cleaning not ready', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }

  const bed = await pool.query(`SELECT id FROM beds WHERE is_active = true ORDER BY id LIMIT 1`);
  if (bed.rowCount === 0) {
    t.skip('no beds');
    return;
  }
  const bedId = bed.rows[0].id;
  await pool.query(`UPDATE beds SET operational_status = 'ready' WHERE id = $1`, [bedId]);

  await withTransaction((client) =>
    releaseBedToTurnover(client, bedId, { id: 1 }, { note: 'test' }),
  );

  const after = await pool.query(`SELECT operational_status FROM beds WHERE id = $1`, [bedId]);
  assert.equal(after.rows[0].operational_status, 'cleaning');

  await pool.query(`UPDATE beds SET operational_status = 'ready' WHERE id = $1`, [bedId]);
});

test('setOperationalStatus rejects direct ready transition', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }

  const bed = await pool.query(`SELECT id FROM beds WHERE is_active = true ORDER BY id LIMIT 1`);
  if (bed.rowCount === 0) {
    t.skip('no beds');
    return;
  }
  const bedId = bed.rows[0].id;
  await pool.query(`UPDATE beds SET operational_status = 'cleaning' WHERE id = $1`, [bedId]);

  await assert.rejects(
    () =>
      setOperationalStatus(bedId, { operationalStatus: 'ready' }, { id: 1 }),
    (err) => err.status === 422,
  );

  await pool.query(`UPDATE beds SET operational_status = 'ready' WHERE id = $1`, [bedId]);
});
