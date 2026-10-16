const { query } = require('../../config/db');

async function buildTriageContext(visitId) {
  const visitRes = await query(
    `SELECT v.id, v.priority, v.chief_complaint, v.arrival_mode, v.care_stage, v.status,
            v.critical_flag, v.current_orientation, p.sex, p.birth_date
     FROM visits v
     JOIN patients p ON p.id = v.patient_id
     WHERE v.id = $1`,
    [visitId],
  );
  if (visitRes.rowCount === 0) {
    throw { status: 404, message: 'Visit not found.' };
  }
  const v = visitRes.rows[0];

  const triageRes = await query(
    `SELECT priority, assessment_type, clinical_note, vitals, orientation, performed_at
     FROM triage_assessments
     WHERE visit_id = $1
     ORDER BY performed_at DESC
     LIMIT 5`,
    [visitId],
  );

  return {
    visitId: Number(v.id),
    currentPriority: Number(v.priority),
    chiefComplaint: v.chief_complaint,
    arrivalMode: v.arrival_mode,
    careStage: v.care_stage,
    status: v.status,
    criticalFlag: Boolean(v.critical_flag),
    orientation: v.current_orientation,
    patient: {
      sex: v.sex,
      birthDate: v.birth_date,
    },
    recentTriage: triageRes.rows,
  };
}

module.exports = {
  buildTriageContext,
};
