const { getVisitDetails } = require('../../services/visitService');
const { query } = require('../../config/db');

function minimizePatient(patient) {
  if (!patient) return null;
  return {
    ageBand: patient.birthDate ? 'redacted' : null,
    sex: patient.sex || null,
  };
}

async function buildDocumentationContext(visitId) {
  const detail = await getVisitDetails(visitId);
  const tasksRes = await query(
    `SELECT title, status, created_at, completed_at
     FROM care_tasks WHERE visit_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [visitId],
  );
  const examsRes = await query(
    `SELECT label, exam_type, status, requested_at
     FROM exams WHERE visit_id = $1 ORDER BY requested_at DESC LIMIT 20`,
    [visitId],
  );

  return {
    visit: {
      visitId: detail.visitId,
      status: detail.status,
      careStage: detail.careStage,
      priority: detail.priority,
      chiefComplaint: detail.chiefComplaint,
      orientation: detail.orientation,
    },
    patient: minimizePatient(detail.patient),
    consultation: detail.consultation
      ? {
          diagnosis: detail.consultation.diagnosis,
          notes: detail.consultation.notes,
          startedAt: detail.consultation.startedAt,
        }
      : null,
    timeline: (detail.timeline || []).slice(-30).map((e) => ({
      eventType: e.eventType,
      createdAt: e.createdAt,
      actorType: e.actorType,
    })),
    careTasks: tasksRes.rows,
    exams: examsRes.rows,
  };
}

module.exports = {
  buildDocumentationContext,
};
