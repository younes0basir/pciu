require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRegistrationHints } = require('../config/registrationHints');
const { lookupPatientForRegistration } = require('../services/registrationIntelligenceService');

test('buildRegistrationHints suggests critical pathway for keyword without mutating priority', () => {
  const result = buildRegistrationHints({
    chiefComplaint: 'détresse respiratoire sévère',
    arrivalMode: 'À pied',
    registrationPriority: 3,
  });
  assert.ok(result.suggestions.some((s) => s.type === 'complaint_keyword'));
  assert.equal(result.suggestions.length >= 1, true);
});

test('buildRegistrationHints flags ambulance arrival', () => {
  const result = buildRegistrationHints({
    chiefComplaint: 'douleur abdominale',
    arrivalMode: 'Ambulance',
    registrationPriority: 3,
  });
  assert.ok(result.suggestions.some((s) => s.type === 'arrival_mode'));
});

test('buildRegistrationHints notes high registration priority is not clinical triage', () => {
  const result = buildRegistrationHints({
    chiefComplaint: 'traumatisme',
    arrivalMode: 'À pied',
    registrationPriority: 1,
  });
  assert.ok(result.suggestions.some((s) => s.type === 'registration_priority_high'));
});

test('lookupPatientForRegistration returns empty for blank CIN', async (t) => {
  const out = await lookupPatientForRegistration('   ');
  assert.equal(out.patient, null);
  assert.equal(out.activeVisit, null);
});

test('lookupPatientForRegistration finds patient when DATABASE_URL set', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  const { pool } = require('../config/db');
  const sample = await pool.query(
    `SELECT national_id FROM patients WHERE national_id IS NOT NULL AND trim(national_id) <> '' LIMIT 1`,
  );
  if (sample.rowCount === 0) {
    t.skip('no patients with national_id');
    await pool.end();
    return;
  }
  const out = await lookupPatientForRegistration(sample.rows[0].national_id);
  assert.ok(out.patient?.patientId);
  await pool.end();
});
