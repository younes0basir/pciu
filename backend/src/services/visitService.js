const { query, withTransaction } = require('../config/db');
const { logVisitAction } = require('../lib/visitActionLogger');
const {
  assertDoctorCanManageVisit,
  assertNurseCanManageVisit,
} = require('./roomAccessService');
const {
  findIdempotentActionResult,
  recordVisitEvent,
} = require('./visitEventService');
const { assertBedAssignable, releaseBedToTurnover } = require('./resourceService');
const { mapVisitPriorityFields } = require('../lib/visitPriority');
const { decideDisposition } = require('./careService');
const { V3_OUTCOMES, mapCloseOutcomeToLegacyStatus } = require('../lib/careStage');

// Helper to generate human-readable public code like V-2610-A1B2
function generatePublicCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `V-${dateStr}-${rand}`;
}

async function registerVisit(data, actorUser, actionContext = {}) {
  const result = await registerVisitTransaction(data, actorUser, actionContext);
  setImmediate(() => {
    const { maybeRunShadowTriage } = require('../ai/shadow/triage-shadow-trigger');
    maybeRunShadowTriage(result.visitId).catch(() => {});
  });
  return result;
}

async function registerVisitTransaction(data, actorUser, actionContext = {}) {
  const {
    firstName,
    lastName,
    nationalId,
    phone,
    birthDate,
    sex,
    priority,
    chiefComplaint,
    arrivalMode,
    criticalFlag,
  } = data;

  if (!firstName || !lastName) {
    throw { status: 400, message: 'First name and last name are required.' };
  }
  if (!priority || priority < 1 || priority > 5) {
    throw { status: 400, message: 'Priority must be an integer between 1 and 5.' };
  }
  if (!chiefComplaint || !chiefComplaint.trim()) {
    throw { status: 400, message: 'Chief complaint is required.' };
  }

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) {
      return replay;
    }

    let patientId;

    // 1. Find or create patient
    if (nationalId && nationalId.trim()) {
      const cleanNationalId = nationalId.trim().toUpperCase();
      const existingPatient = await client.query(
        'SELECT id FROM patients WHERE upper(trim(national_id)) = $1',
        [cleanNationalId]
      );

      if (existingPatient.rowCount > 0) {
        patientId = existingPatient.rows[0].id;
        // Update contact/name if provided
        await client.query(
          `UPDATE patients 
           SET first_name = $1, last_name = $2, phone = COALESCE($3, phone), updated_at = NOW() 
           WHERE id = $4`,
          [firstName.trim(), lastName.trim(), phone?.trim() || null, patientId]
        );
      } else {
        const newPatient = await client.query(
          `INSERT INTO patients (first_name, last_name, national_id, phone, birth_date, sex)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            firstName.trim(),
            lastName.trim(),
            cleanNationalId,
            phone?.trim() || null,
            birthDate || null,
            sex || null,
          ]
        );
        patientId = newPatient.rows[0].id;
      }
    } else {
      const newPatient = await client.query(
        `INSERT INTO patients (first_name, last_name, phone, birth_date, sex)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          firstName.trim(),
          lastName.trim(),
          phone?.trim() || null,
          birthDate || null,
          sex || null,
        ]
      );
      patientId = newPatient.rows[0].id;
    }

    // 2. Ensure patient has no existing active visit
    const activeVisit = await client.query(
      `SELECT id, status, care_stage FROM visits 
       WHERE patient_id = $1
         AND closed_at IS NULL
         AND (status IN ('waiting', 'placed', 'in_treatment')
              OR care_stage IS DISTINCT FROM 'completed')`,
      [patientId]
    );

    if (activeVisit.rowCount > 0) {
      throw {
        status: 409,
        message: `Patient already has an active visit (#${activeVisit.rows[0].id}) in status '${activeVisit.rows[0].status}'.`,
      };
    }

    // 3. Create visit
    const publicCode = generatePublicCode();
    const visitResult = await client.query(
      `INSERT INTO visits (
        public_code,
        patient_id,
        status,
        care_stage,
        patient_location,
        priority,
        registration_priority,
        chief_complaint,
        arrival_mode,
        registered_by,
        critical_flag,
        current_orientation
      ) VALUES ($1, $2, 'waiting', 'triage_pending', 'waiting_area', $3, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        publicCode,
        patientId,
        priority,
        chiefComplaint.trim(),
        arrivalMode || null,
        actorUser?.id || null,
        Boolean(criticalFlag),
        criticalFlag ? 'critical' : null,
      ]
    );

    const visit = visitResult.rows[0];

    const result = {
      visitId: visit.id,
      publicCode: visit.public_code,
      status: visit.status,
      careStage: visit.care_stage,
      priority: visit.priority,
      chiefComplaint: visit.chief_complaint,
      patientId,
      patientName: `${firstName.trim()} ${lastName.trim()}`,
      arrivedAt: visit.arrived_at,
    };

    await recordVisitEvent(client, {
      visitId: visit.id,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'registered',
      fromStatus: null,
      toStatus: 'waiting',
      metadata: {
        priority,
        chiefComplaint: chiefComplaint.trim(),
        arrivalMode: arrivalMode || null,
      },
      actionResult: result,
    });

    logVisitAction({
      action: 'register',
      visitId: visit.id,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function callVisit(visitId, actorUser, actionContext = {}) {
  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) {
      return replay;
    }

    const visitRes = await client.query(
      'SELECT id, status, call_count FROM visits WHERE id = $1 FOR UPDATE',
      [visitId]
    );

    if (visitRes.rowCount === 0) {
      throw { status: 404, message: 'Visit not found.' };
    }

    const visit = visitRes.rows[0];
    if (visit.status !== 'waiting') {
      throw {
        status: 400,
        message: `Cannot call visit. Current status is '${visit.status}' (must be 'waiting').`,
      };
    }

    const newCallCount = Number(visit.call_count) + 1;

    // Update visits
    const updatedRes = await client.query(
      `UPDATE visits 
       SET last_called_at = NOW(), call_count = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [newCallCount, visitId]
    );

    const result = {
      visitId: updatedRes.rows[0].id,
      status: updatedRes.rows[0].status,
      callCount: newCallCount,
      lastCalledAt: updatedRes.rows[0].last_called_at,
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'called',
      fromStatus: 'waiting',
      toStatus: 'waiting',
      metadata: { callCount: newCallCount },
      actionResult: result,
    });

    logVisitAction({
      action: 'call',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function placeVisit(visitId, bedId, actorUser, actionContext = {}) {
  if (!bedId) {
    throw { status: 400, message: 'bedId is required.' };
  }

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) {
      return replay;
    }

    // 1. Lock visit
    const visitRes = await client.query(
      'SELECT id, status, care_stage FROM visits WHERE id = $1 FOR UPDATE',
      [visitId]
    );

    if (visitRes.rowCount === 0) {
      throw { status: 404, message: 'Visit not found.' };
    }

    const visit = visitRes.rows[0];
    if (visit.care_stage === 'completed') {
      throw { status: 400, message: 'Visite déjà terminée.' };
    }
    if (visit.status !== 'waiting') {
      throw {
        status: 400,
        message: `Cannot place patient. Current status is '${visit.status}' (must be 'waiting').`,
      };
    }

    const bedRow = await assertBedAssignable(client, bedId);

    // 3. Verify bed is free
    const currentAssignment = await client.query(
      'SELECT id, visit_id FROM bed_assignments WHERE bed_id = $1 AND released_at IS NULL',
      [bedId]
    );

    if (currentAssignment.rowCount > 0) {
      throw {
        status: 409,
        message: `Bed #${bedId} is already occupied by visit #${currentAssignment.rows[0].visit_id}.`,
      };
    }

    // 4. Verify visit does not already have an active bed
    const visitAssignment = await client.query(
      'SELECT id, bed_id FROM bed_assignments WHERE visit_id = $1 AND released_at IS NULL',
      [visitId]
    );

    if (visitAssignment.rowCount > 0) {
      throw {
        status: 409,
        message: `Visit #${visitId} is already assigned to bed #${visitAssignment.rows[0].bed_id}.`,
      };
    }

    // 5. Insert bed assignment
    const assignRes = await client.query(
      `INSERT INTO bed_assignments (visit_id, bed_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [visitId, bedId, actorUser?.id || null]
    );

    await client.query(
      `UPDATE visits
       SET status = 'placed',
           care_stage = CASE
             WHEN care_stage IN ('registered', 'triage_pending') THEN 'waiting_care'
             ELSE care_stage
           END,
           patient_location = 'resource',
           updated_at = NOW()
       WHERE id = $1`,
      [visitId]
    );

    const result = {
      visitId,
      status: 'placed',
      careStage: 'waiting_care',
      bedId,
      assignedAt: assignRes.rows[0].assigned_at,
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'placed',
      fromStatus: 'waiting',
      toStatus: 'placed',
      metadata: { bedId, assignmentId: assignRes.rows[0].id },
      actionResult: result,
    });

    logVisitAction({
      action: 'place',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function resolveAttributedDoctor(client, actorUser, requestedDoctorId, { visitId } = {}) {
  if (!actorUser?.id) {
    throw { status: 401, message: 'Authentication required.' };
  }

  if (actorUser.role === 'doctor') {
    if (requestedDoctorId != null && Number(requestedDoctorId) !== Number(actorUser.id)) {
      throw { status: 403, message: 'Un médecin ne peut ouvrir une consultation qu’en son nom.' };
    }
    return Number(actorUser.id);
  }

  if (actorUser.role === 'nurse') {
    if (visitId == null) {
      throw { status: 400, message: 'Visite requise pour attribuer le médecin.' };
    }
    const bedRoom = await assertNurseCanManageVisit(client, actorUser, visitId);
    if (!bedRoom.doctor_id) {
      throw {
        status: 400,
        message: 'Aucun médecin responsable n’est affecté à cette salle. Contactez le chef de service.',
      };
    }
    const roomDoctorId = Number(bedRoom.doctor_id);
    if (requestedDoctorId != null && Number(requestedDoctorId) !== roomDoctorId) {
      throw {
        status: 403,
        message: 'L’infirmier ne peut rédiger la consultation qu’au nom du médecin de la salle.',
      };
    }
    return roomDoctorId;
  }

  if (actorUser.role === 'chief') {
    const targetId = requestedDoctorId != null ? Number(requestedDoctorId) : Number(actorUser.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      throw { status: 400, message: 'Choisissez le médecin au nom duquel la consultation est rédigée.' };
    }
    const doctorRes = await client.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [targetId]
    );
    const doctor = doctorRes.rows[0];
    if (!doctor || !doctor.is_active || !['doctor', 'chief'].includes(doctor.role)) {
      throw {
        status: 400,
        message: 'Choisissez un médecin actif, ou vous-même en tant que chef.',
      };
    }
    return Number(doctor.id);
  }

  throw { status: 403, message: 'Permission denied.' };
}

function cleanClinicalText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

async function startConsultation(visitId, actorUser, data = {}, actionContext = {}) {
  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) {
      return replay;
    }

    const visitRes = await client.query(
      'SELECT id, status, care_stage FROM visits WHERE id = $1 FOR UPDATE',
      [visitId]
    );

    if (visitRes.rowCount === 0) {
      throw { status: 404, message: 'Visit not found.' };
    }

    const visit = visitRes.rows[0];
    const canStart =
      visit.status === 'placed' ||
      visit.status === 'in_treatment' ||
      (visit.status === 'waiting' &&
        ['waiting_care', 'triage_pending', 'in_care'].includes(visit.care_stage));

    if (!canStart) {
      throw {
        status: 400,
        message: `Cannot start consultation. Current status is '${visit.status}'.`,
      };
    }

    const bedAssignment = await client.query(
      'SELECT id, bed_id FROM bed_assignments WHERE visit_id = $1 AND released_at IS NULL',
      [visitId]
    );

    if (bedAssignment.rowCount === 0 && visit.care_stage !== 'triage_pending') {
      // V3: care can start without bed only for critical fast-track (optional bed later)
      const criticalRes = await client.query(
        'SELECT critical_flag FROM visits WHERE id = $1',
        [visitId],
      );
      if (!criticalRes.rows[0]?.critical_flag) {
        throw { status: 400, message: 'Visit has no active bed assignment.' };
      }
    }

    if (actorUser.role === 'doctor') {
      await assertDoctorCanManageVisit(client, actorUser, visitId);
    }

    const doctorId = await resolveAttributedDoctor(client, actorUser, data.doctorId, { visitId });
    const diagnosis = cleanClinicalText(data.diagnosis);
    const notes = cleanClinicalText(data.notes);

    // Create consultation row. doctor_id is the clinician of record.
    // recorded_by is whoever actually wrote it (the chef, when acting for someone else).
    const consultRes = await client.query(
      `INSERT INTO consultations (visit_id, doctor_id, recorded_by, started_at, diagnosis, notes)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       RETURNING *`,
      [visitId, doctorId, actorUser.id, diagnosis, notes]
    );

    await client.query(
      `UPDATE visits
       SET status = 'in_treatment',
           care_stage = 'in_care',
           care_started_at = COALESCE(care_started_at, NOW()),
           patient_location = COALESCE(patient_location, 'resource'),
           updated_at = NOW()
       WHERE id = $1`,
      [visitId]
    );

    const result = {
      visitId,
      status: 'in_treatment',
      careStage: 'in_care',
      consultationId: consultRes.rows[0].id,
      doctorId,
      startedAt: consultRes.rows[0].started_at,
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'consultation_started',
      fromStatus: 'placed',
      toStatus: 'in_treatment',
      metadata: {
        consultationId: consultRes.rows[0].id,
        doctorId,
        recordedBy: actorUser.id,
      },
      actionResult: result,
    });

    logVisitAction({
      action: 'start',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function updateConsultation(visitId, data, actorUser, actionContext = {}) {
  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) {
      return replay;
    }

    const visitRes = await client.query(
      'SELECT id, status FROM visits WHERE id = $1 FOR UPDATE',
      [visitId]
    );

    if (visitRes.rowCount === 0) {
      throw { status: 404, message: 'Visit not found.' };
    }

    if (visitRes.rows[0].status !== 'in_treatment') {
      throw {
        status: 400,
        message: 'La consultation ne peut être complétée que pendant la prise en charge.',
      };
    }

    const consultRes = await client.query(
      `SELECT id, doctor_id, diagnosis, notes
       FROM consultations
       WHERE visit_id = $1 AND ended_at IS NULL
       FOR UPDATE`,
      [visitId]
    );

    if (consultRes.rowCount === 0) {
      throw { status: 400, message: 'Aucune consultation ouverte pour cette visite.' };
    }

    const consult = consultRes.rows[0];
    if (actorUser.role === 'doctor') {
      if (Number(consult.doctor_id) !== Number(actorUser.id)) {
        throw { status: 403, message: 'Cette consultation est attribuée à un autre médecin.' };
      }
    } else if (actorUser.role === 'nurse') {
      await assertNurseCanManageVisit(client, actorUser, visitId);
    }

    let doctorId = Number(consult.doctor_id);
    if (data.doctorId != null) {
      doctorId = await resolveAttributedDoctor(client, actorUser, data.doctorId, { visitId });
    } else if (actorUser.role === 'nurse') {
      doctorId = await resolveAttributedDoctor(client, actorUser, null, { visitId });
    }

    const diagnosis = data.diagnosis === undefined ? consult.diagnosis : cleanClinicalText(data.diagnosis);
    const notes = data.notes === undefined ? consult.notes : cleanClinicalText(data.notes);

    const updated = await client.query(
      `UPDATE consultations
       SET doctor_id = $1,
           recorded_by = $2,
           diagnosis = $3,
           notes = $4
       WHERE id = $5
       RETURNING id, doctor_id, started_at`,
      [doctorId, actorUser.id, diagnosis, notes, consult.id]
    );

    const result = {
      visitId,
      consultationId: updated.rows[0].id,
      doctorId,
      diagnosis,
      notes,
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser.id,
      actionContext,
      eventType: 'consultation_updated',
      fromStatus: 'in_treatment',
      toStatus: 'in_treatment',
      metadata: {
        consultationId: updated.rows[0].id,
        doctorId,
        recordedBy: actorUser.id,
      },
      actionResult: result,
    });

    logVisitAction({
      action: 'fill',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function closeVisit(visitId, data, actorUser, actionContext = {}) {
  const { outcome, diagnosis, notes, releaseReason } = data;
  const legacyOutcomes = ['discharged', 'transferred', 'left_without_seen'];
  const allowedOutcomes = [...new Set([...legacyOutcomes, ...V3_OUTCOMES])];

  if (!outcome || !allowedOutcomes.includes(outcome)) {
    throw {
      status: 400,
      message: `Invalid outcome. Must be one of: ${allowedOutcomes.join(', ')}.`,
    };
  }

  if (outcome === 'admitted') {
    return decideDisposition(visitId, { outcome: 'admitted' }, actorUser, actionContext);
  }

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) {
      return replay;
    }

    const visitRes = await client.query(
      'SELECT id, status, care_stage FROM visits WHERE id = $1 FOR UPDATE',
      [visitId]
    );

    if (visitRes.rowCount === 0) {
      throw { status: 404, message: 'Visit not found.' };
    }

    const visit = visitRes.rows[0];
    const leftOutcomes = ['left_without_seen', 'left_before_seen', 'left_during_care'];
    const canCloseFromWaiting =
      visit.status === 'waiting' && leftOutcomes.includes(outcome);
    if (
      !['placed', 'in_treatment'].includes(visit.status) &&
      !canCloseFromWaiting &&
      visit.care_stage !== 'disposition_pending'
    ) {
      throw {
        status: 400,
        message: `Cannot close visit. Current status is '${visit.status}'.`,
      };
    }

    if (actorUser.role === 'doctor' && visit.status !== 'waiting') {
      await assertDoctorCanManageVisit(client, actorUser, visitId);
    } else if (actorUser.role === 'nurse' && visit.status !== 'waiting') {
      await assertNurseCanManageVisit(client, actorUser, visitId);
    }

    const fromStatus = visit.status;
    const legacyStatus = mapCloseOutcomeToLegacyStatus(outcome);

    // 1. Release bed assignment
    await client.query(
      `UPDATE bed_assignments 
       SET released_at = NOW(), released_by = $1, release_reason = COALESCE($2, $3)
       WHERE visit_id = $4 AND released_at IS NULL`,
      [actorUser?.id || null, releaseReason || null, outcome, visitId]
    );

    const releasedBed = await client.query(
      `SELECT bed_id FROM bed_assignments
       WHERE visit_id = $1 AND released_at IS NOT NULL
       ORDER BY released_at DESC LIMIT 1`,
      [visitId],
    );
    if (releasedBed.rowCount > 0) {
      await releaseBedToTurnover(client, releasedBed.rows[0].bed_id, actorUser, {
        note: releaseReason || outcome,
        visitId,
      });
    }

    // 2. End active consultation if open
    await client.query(
      `UPDATE consultations 
       SET ended_at = NOW(), diagnosis = COALESCE($1, diagnosis), notes = COALESCE($2, notes)
       WHERE visit_id = $3 AND ended_at IS NULL`,
      [diagnosis || null, notes || null, visitId]
    );

    // 3. Close visit
    const v3Outcome =
      outcome === 'left_without_seen' ? 'left_before_seen' : outcome;

    const updatedVisit = await client.query(
      `UPDATE visits 
       SET status = $1,
           care_stage = 'completed',
           outcome = $2,
           patient_location = 'discharged',
           closed_at = NOW(),
           updated_at = NOW() 
       WHERE id = $3
       RETURNING *`,
      [legacyStatus, v3Outcome, visitId]
    );

    const result = {
      visitId,
      status: legacyStatus,
      outcome: v3Outcome,
      careStage: 'completed',
      closedAt: updatedVisit.rows[0].closed_at,
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'closed',
      fromStatus,
      toStatus: legacyStatus,
      metadata: { outcome, diagnosis: diagnosis || null, notes: notes || null },
      actionResult: result,
    });

    logVisitAction({
      action: 'close',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function returnVisit(visitId, data, actorUser, actionContext = {}) {
  const { reason } = data;

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) {
      return replay;
    }

    const visitRes = await client.query(
      'SELECT id, status FROM visits WHERE id = $1 FOR UPDATE',
      [visitId]
    );

    if (visitRes.rowCount === 0) {
      throw { status: 404, message: 'Visit not found.' };
    }

    const visit = visitRes.rows[0];
    if (visit.status !== 'placed') {
      throw {
        status: 400,
        message: `Cannot return visit. Current status is '${visit.status}' (must be 'placed').`,
      };
    }

    const activeBed = await client.query(
      `SELECT bed_id FROM bed_assignments
       WHERE visit_id = $1 AND released_at IS NULL`,
      [visitId],
    );

    await client.query(
      `UPDATE bed_assignments 
       SET released_at = NOW(), released_by = $1, release_reason = COALESCE($2, 'Returned to waiting')
       WHERE visit_id = $3 AND released_at IS NULL`,
      [actorUser?.id || null, reason || null, visitId]
    );

    if (activeBed.rowCount > 0) {
      await releaseBedToTurnover(client, activeBed.rows[0].bed_id, actorUser, {
        note: reason || 'Returned to waiting',
        visitId,
      });
    }

    // 2. Update visit status to 'waiting'
    const updatedVisit = await client.query(
      `UPDATE visits
       SET status = 'waiting',
           care_stage = 'waiting_care',
           patient_location = 'waiting_area',
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [visitId]
    );

    const result = {
      visitId,
      status: 'waiting',
      careStage: 'waiting_care',
      returnedAt: updatedVisit.rows[0].updated_at,
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'returned',
      fromStatus: 'placed',
      toStatus: 'waiting',
      metadata: { reason: reason || 'Returned to waiting' },
      actionResult: result,
    });

    logVisitAction({
      action: 'return',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function updateVisitPriority(visitId, data, actorUser, actionContext = {}) {
  const priority = Number(data?.priority);
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    throw { status: 400, message: 'La priorité doit être entre 1 (urgent) et 5 (non urgent).' };
  }

  const note = data?.note != null ? String(data.note).trim() : '';

  return withTransaction(async (client) => {
    const replay = await findIdempotentActionResult(client, actionContext.idempotencyKey);
    if (replay) {
      return replay;
    }

    const visitRes = await client.query(
      'SELECT id, status, priority, care_stage FROM visits WHERE id = $1 FOR UPDATE',
      [visitId]
    );

    if (visitRes.rowCount === 0) {
      throw { status: 404, message: 'Visit not found.' };
    }

    const visit = visitRes.rows[0];
    const careStage = visit.care_stage || 'triage_pending';
    if (
      visit.status !== 'waiting' ||
      !['triage_pending', 'waiting_care', 'registered'].includes(careStage)
    ) {
      throw {
        status: 400,
        message: 'Le triage ne peut être ajusté que pour les patients en attente de prise en charge.',
      };
    }

    const previousPriority = Number(visit.priority);
    if (previousPriority === priority && !note) {
      const unchanged = { visitId, priority, unchanged: true };
      if (actionContext.idempotencyKey) {
        await recordVisitEvent(client, {
          visitId,
          actorUserId: actorUser?.id || null,
          actionContext,
          eventType: 'triage_validated',
          fromStatus: 'waiting',
          toStatus: 'waiting',
          metadata: { previousPriority, priority, note: null, unchanged: true },
          actionResult: unchanged,
        });
      }
      return unchanged;
    }

    await client.query(
      `UPDATE visits
       SET priority = $1,
           clinical_priority_validated_at = COALESCE(clinical_priority_validated_at, NOW()),
           care_stage = CASE WHEN care_stage IN ('registered', 'triage_pending') THEN 'waiting_care' ELSE care_stage END,
           updated_at = NOW()
       WHERE id = $2`,
      [priority, visitId]
    );

    await client.query(
      `INSERT INTO triage_assessments (
        visit_id, priority, assessment_type, clinical_note, performed_by, performed_at
      ) VALUES ($1, $2, 'initial', $3, $4, NOW())`,
      [visitId, priority, note || null, actorUser?.id || null],
    );

    const result = {
      visitId,
      priority,
      previousPriority,
      careStage: 'waiting_care',
    };

    await recordVisitEvent(client, {
      visitId,
      actorUserId: actorUser?.id || null,
      actionContext,
      eventType: 'triage_validated',
      fromStatus: 'waiting',
      toStatus: 'waiting',
      metadata: {
        previousPriority,
        priority,
        note: note || null,
      },
      actionResult: result,
    });

    logVisitAction({
      action: 'triage',
      visitId,
      actorUserId: actorUser?.id ?? null,
      actorType: actionContext.actorType ?? 'user',
      status: 'ok',
    });

    return result;
  });
}

async function getVisitDetails(visitId) {
  // 1. Patient & Visit info (no vitals - schema has none)
  const visitRes = await query(
    `SELECT 
      v.id AS visit_id,
      v.public_code,
      v.status,
      v.care_stage,
      v.critical_flag,
      v.current_orientation,
      v.outcome,
      v.patient_location,
      v.care_started_at,
      v.disposition_decided_at,
      v.priority,
      v.registration_priority,
      v.clinical_priority_validated_at,
      v.chief_complaint,
      v.arrival_mode,
      v.arrived_at,
      v.last_called_at,
      v.call_count,
      v.closed_at,
      v.created_at,
      p.id AS patient_id,
      p.first_name,
      p.last_name,
      p.national_id,
      p.phone,
      p.birth_date,
      p.sex
    FROM visits v
    JOIN patients p ON p.id = v.patient_id
    WHERE v.id = $1`,
    [visitId]
  );

  if (visitRes.rowCount === 0) {
    throw { status: 404, message: 'Visit not found.' };
  }

  const v = visitRes.rows[0];

  // 2. Active bed (if any)
  const bedRes = await query(
    `SELECT 
      b.id AS bed_id,
      b.label AS bed_label,
      b.operational_status AS bed_operational_status,
      r.id AS room_id,
      r.name AS room_name,
      z.id AS zone_id,
      z.name AS zone_name,
      z.color AS zone_color,
      ba.assigned_at
    FROM bed_assignments ba
    JOIN beds b ON b.id = ba.bed_id
    JOIN rooms r ON r.id = b.room_id
    JOIN zones z ON z.id = r.zone_id
    WHERE ba.visit_id = $1 AND ba.released_at IS NULL`,
    [visitId]
  );

  // 3. Active or latest consultation (if any)
  const consultRes = await query(
    `SELECT 
      c.id AS consultation_id,
      c.started_at,
      c.ended_at,
      c.diagnosis,
      c.notes,
      u.id AS doctor_id,
      u.first_name AS doctor_first_name,
      u.last_name AS doctor_last_name,
      u.role AS doctor_role,
      rec.id AS recorded_by_id,
      rec.first_name AS recorded_by_first_name,
      rec.last_name AS recorded_by_last_name,
      rec.role AS recorded_by_role
    FROM consultations c
    JOIN users u ON u.id = c.doctor_id
    LEFT JOIN users rec ON rec.id = c.recorded_by
    WHERE c.visit_id = $1
    ORDER BY c.started_at DESC
    LIMIT 1`,
    [visitId]
  );

  // 4. Timeline of events
  const timelineRes = await query(
    `SELECT 
      e.id,
      e.event_type,
      e.from_status,
      e.to_status,
      e.metadata,
      e.created_at,
      e.actor_type,
      e.agent_run_id,
      u.first_name AS actor_first_name,
      u.last_name AS actor_last_name,
      u.role AS actor_role
    FROM visit_events e
    LEFT JOIN users u ON u.id = e.actor_user_id
    WHERE e.visit_id = $1
    ORDER BY e.created_at ASC, e.id ASC`,
    [visitId]
  );

  return {
    visitId: v.visit_id,
    publicCode: v.public_code,
    status: v.status,
    careStage: v.care_stage,
    criticalFlag: Boolean(v.critical_flag),
    orientation: v.current_orientation,
    outcome: v.outcome,
    patientLocation: v.patient_location,
    careStartedAt: v.care_started_at,
    dispositionDecidedAt: v.disposition_decided_at,
    ...mapVisitPriorityFields(v),
    chiefComplaint: v.chief_complaint,
    arrivalMode: v.arrival_mode,
    arrivedAt: v.arrived_at,
    lastCalledAt: v.last_called_at,
    callCount: Number(v.call_count),
    closedAt: v.closed_at,
    patient: {
      id: v.patient_id,
      firstName: v.first_name,
      lastName: v.last_name,
      fullName: `${v.first_name} ${v.last_name}`,
      nationalId: v.national_id,
      phone: v.phone,
      birthDate: v.birth_date,
      sex: v.sex,
    },
    activeBed: bedRes.rows[0]
      ? {
          bedId: bedRes.rows[0].bed_id,
          bedLabel: bedRes.rows[0].bed_label,
          operationalStatus: bedRes.rows[0].bed_operational_status,
          roomId: bedRes.rows[0].room_id,
          roomName: bedRes.rows[0].room_name,
          zoneId: bedRes.rows[0].zone_id,
          zoneName: bedRes.rows[0].zone_name,
          zoneColor: bedRes.rows[0].zone_color,
          assignedAt: bedRes.rows[0].assigned_at,
        }
      : null,
    consultation: consultRes.rows[0]
      ? {
          id: consultRes.rows[0].consultation_id,
          startedAt: consultRes.rows[0].started_at,
          endedAt: consultRes.rows[0].ended_at,
          diagnosis: consultRes.rows[0].diagnosis,
          notes: consultRes.rows[0].notes,
          doctorId: Number(consultRes.rows[0].doctor_id),
          doctorRole: consultRes.rows[0].doctor_role,
          doctorName: `${consultRes.rows[0].doctor_first_name} ${consultRes.rows[0].doctor_last_name}`,
          recordedById: consultRes.rows[0].recorded_by_id
            ? Number(consultRes.rows[0].recorded_by_id)
            : null,
          recordedByName: consultRes.rows[0].recorded_by_first_name
            ? `${consultRes.rows[0].recorded_by_first_name} ${consultRes.rows[0].recorded_by_last_name}`
            : null,
          recordedByRole: consultRes.rows[0].recorded_by_role || null,
        }
      : null,
    timeline: timelineRes.rows.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      metadata: e.metadata,
      createdAt: e.created_at,
      actorName: e.actor_first_name ? `${e.actor_first_name} ${e.actor_last_name}` : 'System',
      actorRole: e.actor_role,
      actorType: e.actor_type,
      agentRunId: e.agent_run_id,
    })),
  };
}

module.exports = {
  registerVisit,
  callVisit,
  placeVisit,
  startConsultation,
  updateConsultation,
  updateVisitPriority,
  closeVisit,
  returnVisit,
  getVisitDetails,
};
