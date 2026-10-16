const { query } = require('../config/db');
const { buildRegistrationHints } = require('../config/registrationHints');
const { getTriageQueue } = require('./queueService');

async function lookupPatientForRegistration(nationalId) {
  const clean = String(nationalId || '').trim().toUpperCase();
  if (!clean) {
    return { patient: null, activeVisit: null, recentVisits: [] };
  }

  const patientRes = await query(
    `SELECT id, first_name, last_name, national_id, phone, birth_date, sex
     FROM patients
     WHERE upper(trim(national_id)) = $1
     LIMIT 1`,
    [clean],
  );

  if (patientRes.rowCount === 0) {
    return { patient: null, activeVisit: null, recentVisits: [] };
  }

  const p = patientRes.rows[0];
  const patient = {
    patientId: Number(p.id),
    firstName: p.first_name,
    lastName: p.last_name,
    nationalId: p.national_id,
    phone: p.phone,
    birthDate: p.birth_date,
    sex: p.sex,
  };

  const activeRes = await query(
    `SELECT v.id, v.public_code, v.status, v.care_stage, v.arrived_at, v.priority
     FROM visits v
     WHERE v.patient_id = $1
       AND v.closed_at IS NULL
       AND (v.status IN ('waiting', 'placed', 'in_treatment')
            OR v.care_stage IS DISTINCT FROM 'completed')
     ORDER BY v.arrived_at DESC
     LIMIT 1`,
    [p.id],
  );

  const activeVisit =
    activeRes.rowCount > 0
      ? {
          visitId: Number(activeRes.rows[0].id),
          publicCode: activeRes.rows[0].public_code,
          status: activeRes.rows[0].status,
          careStage: activeRes.rows[0].care_stage,
          arrivedAt: activeRes.rows[0].arrived_at,
          priority: Number(activeRes.rows[0].priority),
        }
      : null;

  const recentRes = await query(
    `SELECT v.id, v.public_code, v.status, v.closed_at, v.arrived_at
     FROM visits v
     WHERE v.patient_id = $1
     ORDER BY v.arrived_at DESC
     LIMIT 5`,
    [p.id],
  );

  const recentVisits = recentRes.rows.map((row) => ({
    visitId: Number(row.id),
    publicCode: row.public_code,
    status: row.status,
    arrivedAt: row.arrived_at,
    closedAt: row.closed_at,
  }));

  return { patient, activeVisit, recentVisits };
}

function getRegistrationHints(params) {
  return buildRegistrationHints(params);
}

async function getRegistrationQueueContext() {
  const triage = await getTriageQueue();
  return {
    triageQueueCount: triage.length,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  lookupPatientForRegistration,
  getRegistrationHints,
  getRegistrationQueueContext,
};
