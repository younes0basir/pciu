const { query } = require('../config/db');
const { getPendingExamsQueue } = require('./examTaskService');

const WORKLIST_SORT = `
  ORDER BY v.priority ASC, v.critical_flag DESC, v.arrived_at ASC, v.id ASC
`;

function mapVisitRow(row) {
  return {
    visitId: row.visit_id,
    publicCode: row.public_code,
    priority: row.priority,
    careStage: row.care_stage,
    criticalFlag: Boolean(row.critical_flag),
    orientation: row.current_orientation,
    chiefComplaint: row.chief_complaint,
    arrivedAt: row.arrived_at,
    lastCalledAt: row.last_called_at,
    callCount: Number(row.call_count || 0),
    patientId: row.patient_id,
    patientName: `${row.first_name} ${row.last_name}`,
    nationalId: row.national_id,
    isCalled: Boolean(row.last_called_at && row.call_count > 0),
    outcome: row.outcome,
    dispositionDecidedAt: row.disposition_decided_at,
    bedId: row.bed_id ? Number(row.bed_id) : null,
    bedLabel: row.bed_label || null,
    roomName: row.room_name || null,
    zoneName: row.zone_name || null,
  };
}

const BASE_SELECT = `
  SELECT
    v.id AS visit_id,
    v.public_code,
    v.priority,
    v.care_stage,
    v.critical_flag,
    v.current_orientation,
    v.chief_complaint,
    v.arrived_at,
    v.last_called_at,
    v.call_count,
    v.outcome,
    v.disposition_decided_at,
    p.id AS patient_id,
    p.first_name,
    p.last_name,
    p.national_id,
    b.id AS bed_id,
    b.label AS bed_label,
    r.name AS room_name,
    z.name AS zone_name
  FROM visits v
  JOIN patients p ON p.id = v.patient_id
  LEFT JOIN bed_assignments ba ON ba.visit_id = v.id AND ba.released_at IS NULL
  LEFT JOIN beds b ON b.id = ba.bed_id
  LEFT JOIN rooms r ON r.id = b.room_id
  LEFT JOIN zones z ON z.id = r.zone_id
`;

async function getTriageQueue() {
  const result = await query(
    `${BASE_SELECT}
     WHERE v.closed_at IS NULL AND v.care_stage IN ('registered', 'triage_pending')
     ${WORKLIST_SORT}`,
  );
  return result.rows.map(mapVisitRow);
}

async function getCareQueue() {
  const result = await query(
    `${BASE_SELECT}
     WHERE v.closed_at IS NULL AND v.care_stage = 'waiting_care'
     ${WORKLIST_SORT}`,
  );
  return result.rows.map(mapVisitRow);
}

async function getInCareQueue() {
  const result = await query(
    `${BASE_SELECT}
     WHERE v.closed_at IS NULL AND v.care_stage = 'in_care'
     ${WORKLIST_SORT}`,
  );
  return result.rows.map(mapVisitRow);
}

async function getObservationQueue() {
  const result = await query(
    `${BASE_SELECT}
     WHERE v.closed_at IS NULL AND v.care_stage = 'in_observation'
     ${WORKLIST_SORT}`,
  );
  return result.rows.map(mapVisitRow);
}

async function getDispositionQueue() {
  const result = await query(
    `${BASE_SELECT}
     WHERE v.closed_at IS NULL AND v.care_stage = 'disposition_pending'
     ${WORKLIST_SORT}`,
  );
  return result.rows.map(mapVisitRow);
}

/** Patients whose last triage is older than configured minutes (default 60). */
async function getReassessmentQueue({ maxMinutesSinceTriage = 60 } = {}) {
  const minutes = Math.max(15, Number(maxMinutesSinceTriage) || 60);
  const result = await query(
    `${BASE_SELECT}
     WHERE v.closed_at IS NULL
       AND v.care_stage IN ('waiting_care', 'in_care', 'in_observation')
       AND (
         NOT EXISTS (SELECT 1 FROM triage_assessments ta WHERE ta.visit_id = v.id)
         OR (
           SELECT MAX(ta.performed_at) FROM triage_assessments ta WHERE ta.visit_id = v.id
         ) < NOW() - ($1::text || ' minutes')::interval
       )
     ${WORKLIST_SORT}`,
    [String(minutes)],
  );
  return result.rows.map(mapVisitRow);
}

async function getExamsQueue() {
  return getPendingExamsQueue();
}

async function getAllWorklists(options = {}) {
  const [triage, care, inCare, observation, disposition, reassessment, exams] =
    await Promise.all([
      getTriageQueue(),
      getCareQueue(),
      getInCareQueue(),
      getObservationQueue(),
      getDispositionQueue(),
      getReassessmentQueue(options),
      getExamsQueue(),
    ]);

  return {
    timestamp: new Date().toISOString(),
    triage,
    care,
    inCare,
    observation,
    disposition,
    reassessment,
    exams,
  };
}

module.exports = {
  getTriageQueue,
  getCareQueue,
  getInCareQueue,
  getObservationQueue,
  getDispositionQueue,
  getReassessmentQueue,
  getExamsQueue,
  getAllWorklists,
};
