const { query, withTransaction } = require('../config/db');
const { logVisitAction } = require('../lib/visitActionLogger');
const {
  findIdempotentActionResult,
  recordVisitEvent,
} = require('./visitEventService');

const EXAM_TYPES = ['lab', 'imaging', 'ecg', 'other'];
const EXAM_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

function mapExamRow(row) {
  return {
    id: Number(row.id),
    visitId: Number(row.visit_id),
    label: row.label,
    examType: row.exam_type,
    status: row.status,
    resultSummary: row.result_summary,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
    requestedByName: row.requested_by_name || null,
  };
}

async function listExamsForVisit(visitId) {
  const result = await query(
    `SELECT e.*,
            ru.first_name AS req_first, ru.last_name AS req_last
     FROM exams e
     LEFT JOIN users ru ON ru.id = e.requested_by
     WHERE e.visit_id = $1
     ORDER BY e.requested_at DESC, e.id DESC`,
    [visitId],
  );
  return result.rows.map((row) =>
    mapExamRow({
      ...row,
      requested_by_name: row.req_first ? `${row.req_first} ${row.req_last}` : null,
    }),
  );
}

async function listTasksForVisit(visitId) {
  const result = await query(
    `SELECT t.*, u.first_name, u.last_name
     FROM care_tasks t
     LEFT JOIN users u ON u.id = t.created_by
     WHERE t.visit_id = $1
     ORDER BY t.created_at DESC, t.id DESC`,
    [visitId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    visitId: Number(row.visit_id),
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    createdByName: row.first_name ? `${row.first_name} ${row.last_name}` : null,
  }));
}

async function requestExam(visitId, data, actorUser, actionContext = {}) {
  const label = data?.label != null ? String(data.label).trim() : '';
  if (!label) {
    throw { status: 400, message: 'Le libellé de l’examen est requis.' };
  }
  const examType = data?.examType || 'lab';
  if (!EXAM_TYPES.includes(examType)) {
    throw { status: 400, message: 'Type d’examen invalide.' };
  }

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const visitRes = await client.query(
      'SELECT id, status, care_stage FROM visits WHERE id = $1 FOR UPDATE',
      [visitId],
    );
    if (visitRes.rowCount === 0) throw { status: 404, message: 'Visit not found.' };
    if (visitRes.rows[0].care_stage === 'completed') {
      throw { status: 400, message: 'Visite terminée.' };
    }

    const insert = await client.query(
      `INSERT INTO exams (visit_id, label, exam_type, status, requested_by, requested_at)
       VALUES ($1, $2, $3, 'pending', $4, NOW())
       RETURNING *`,
      [visitId, label, examType, actorUser?.id || null],
    );

    const exam = mapExamRow(insert.rows[0]);

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'exam_requested',
      fromStatus: visitRes.rows[0].status,
      toStatus: visitRes.rows[0].status,
      metadata: { examId: exam.id, label, examType },
      actionResult: exam,
    });

    logVisitAction({
      action: 'exam_request',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return exam;
  });
}

async function completeExam(examId, data, actorUser, actionContext = {}) {
  const resultSummary = data?.resultSummary != null ? String(data.resultSummary).trim() : '';

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const examRes = await client.query(
      `SELECT e.*, v.status AS visit_status, v.care_stage
       FROM exams e
       JOIN visits v ON v.id = e.visit_id
       WHERE e.id = $1
       FOR UPDATE OF e`,
      [examId],
    );
    if (examRes.rowCount === 0) throw { status: 404, message: 'Examen introuvable.' };

    const examRow = examRes.rows[0];
    if (examRow.status === 'completed' || examRow.status === 'cancelled') {
      return mapExamRow(examRow);
    }

    const updated = await client.query(
      `UPDATE exams
       SET status = 'completed',
           result_summary = $1,
           completed_at = NOW(),
           completed_by = $2
       WHERE id = $3
       RETURNING *`,
      [resultSummary || null, actorUser?.id || null, examId],
    );

    const exam = mapExamRow(updated.rows[0]);

    await recordVisitEvent(client, {
      visitId: examRow.visit_id,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'exam_completed',
      fromStatus: examRow.visit_status,
      toStatus: examRow.visit_status,
      metadata: { examId, resultSummary: resultSummary || null },
      actionResult: exam,
    });

    return exam;
  });
}

async function createCareTask(visitId, data, actorUser, actionContext = {}) {
  const title = data?.title != null ? String(data.title).trim() : '';
  if (!title) throw { status: 400, message: 'Titre de tâche requis.' };

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) return replay;

    const visitRes = await client.query('SELECT id, status FROM visits WHERE id = $1', [visitId]);
    if (visitRes.rowCount === 0) throw { status: 404, message: 'Visit not found.' };

    const insert = await client.query(
      `INSERT INTO care_tasks (visit_id, title, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [visitId, title, actorUser?.id || null],
    );

    const task = {
      id: Number(insert.rows[0].id),
      visitId: Number(visitId),
      title,
      status: 'pending',
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'task_created',
      fromStatus: visitRes.rows[0].status,
      toStatus: visitRes.rows[0].status,
      metadata: { taskId: task.id, title },
      actionResult: task,
    });

    return task;
  });
}

async function getPendingExamsQueue() {
  const result = await query(
    `SELECT
      v.id AS visit_id,
      v.public_code,
      v.priority,
      v.care_stage,
      v.critical_flag,
      v.chief_complaint,
      p.first_name,
      p.last_name,
      b.label AS bed_label,
      r.name AS room_name,
      z.name AS zone_name,
      (SELECT COUNT(*)::int FROM exams ex
       WHERE ex.visit_id = v.id AND ex.status IN ('pending', 'in_progress')) AS pending_exams
     FROM visits v
     JOIN patients p ON p.id = v.patient_id
     LEFT JOIN bed_assignments ba ON ba.visit_id = v.id AND ba.released_at IS NULL
     LEFT JOIN beds b ON b.id = ba.bed_id
     LEFT JOIN rooms r ON r.id = b.room_id
     LEFT JOIN zones z ON z.id = r.zone_id
     WHERE v.closed_at IS NULL
       AND EXISTS (
         SELECT 1 FROM exams e
         WHERE e.visit_id = v.id AND e.status IN ('pending', 'in_progress')
       )
     ORDER BY v.priority ASC, v.arrived_at ASC, v.id ASC`,
  );

  return result.rows.map((row) => ({
    visitId: row.visit_id,
    publicCode: row.public_code,
    priority: row.priority,
    careStage: row.care_stage,
    criticalFlag: Boolean(row.critical_flag),
    chiefComplaint: row.chief_complaint,
    patientName: `${row.first_name} ${row.last_name}`,
    pendingExams: row.pending_exams,
    bedLabel: row.bed_label,
    roomName: row.room_name,
    zoneName: row.zone_name,
  }));
}

module.exports = {
  EXAM_TYPES,
  listExamsForVisit,
  listTasksForVisit,
  requestExam,
  completeExam,
  createCareTask,
  getPendingExamsQueue,
};
