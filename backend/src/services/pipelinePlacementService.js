const { query } = require('../config/db');
const { calculateLoad } = require('./capacityService');
const { placeVisit } = require('./visitService');
const { recommendPipelinePlacement } = require('../ai/agents/pipeline-placement-agent');
const { assertAgentEnabled, getEffectiveAiSettings } = require('./aiSettingsService');
const { updateRecommendationStatus } = require('../ai/observability/ai-audit');

const BLOCKED_BED_STATUSES = ['maintenance', 'blocked', 'out_of_service'];

const ORIENTATION_ZONE_HINTS = {
  critical: ['dechoquage', 'sauv'],
  isolation: ['dechoquage', 'sauv'],
  ambulatory: ['ambulatoire'],
  observation: ['surveillance'],
  acute: ['surveillance', 'dechoquage'],
  standard: ['surveillance'],
};

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function zoneMatches(orientation, zoneName) {
  const hints = ORIENTATION_ZONE_HINTS[orientation] || [];
  const zone = fold(zoneName);
  return hints.some((hint) => zone.includes(hint));
}

function isFreeBedStatus(status) {
  return status === 'ready';
}

function pickBed(patient, beds, usedBedIds) {
  const free = beds.filter((bed) => !usedBedIds.has(bed.bedId));
  return free.find((bed) => zoneMatches(patient.orientation, bed.zoneName)) || free[0] || null;
}

function mapQueueRow(row) {
  return {
    visitId: Number(row.visit_id),
    publicCode: row.public_code,
    patientName: `${row.first_name} ${row.last_name}`.trim(),
    priority: Number(row.priority),
    criticalFlag: Boolean(row.critical_flag),
    orientation: row.current_orientation,
    chiefComplaint: row.chief_complaint,
    arrivedAt: row.arrived_at,
    queuePosition: Number(row.queue_position),
    callCount: Number(row.call_count || 0),
  };
}

function mapBedRow(row) {
  const nurseCount = Number(row.nurse_count || 0);
  const doctorName = row.doctor_first_name
    ? `${row.doctor_first_name} ${row.doctor_last_name}`.trim()
    : null;
  return {
    bedId: Number(row.id),
    label: row.label,
    roomName: row.room_name,
    zoneName: row.zone_name,
    doctorName,
    nurseCount,
    staffed: Boolean(row.doctor_id) && nurseCount > 0,
  };
}

async function loadPlacementSnapshot() {
  const [queueRes, bedsRes, load] = await Promise.all([
    query(
      `SELECT visit_id, public_code, priority, critical_flag, current_orientation,
              chief_complaint, arrived_at, queue_position, call_count,
              first_name, last_name
       FROM waiting_board
       ORDER BY queue_position ASC`,
    ),
    query(
      `SELECT b.id, b.label, b.operational_status, r.name AS room_name, z.name AS zone_name,
              d.id AS doctor_id,
              d.first_name AS doctor_first_name,
              d.last_name AS doctor_last_name,
              (
                SELECT COUNT(*)::int
                FROM room_team_nurses rtn
                JOIN users nu ON nu.id = rtn.nurse_id AND nu.is_active = true
                WHERE rtn.room_team_id = rt.id
              ) AS nurse_count
       FROM beds b
       JOIN rooms r ON r.id = b.room_id
       JOIN zones z ON z.id = r.zone_id
       LEFT JOIN room_teams rt ON rt.room_id = r.id
       LEFT JOIN users d ON d.id = rt.doctor_id AND d.is_active = true
       WHERE b.is_active
         AND NOT (b.operational_status = ANY($1::text[]))
         AND NOT EXISTS (
           SELECT 1 FROM bed_assignments ba
           WHERE ba.bed_id = b.id AND ba.released_at IS NULL
         )
       ORDER BY z.display_order, r.display_order, b.display_order, b.label`,
      [BLOCKED_BED_STATUSES],
    ),
    calculateLoad(),
  ]);

  const freeBeds = bedsRes.rows.filter((row) => isFreeBedStatus(row.operational_status)).map(mapBedRow);
  const assignable = freeBeds.filter((bed) => bed.staffed);
  return {
    queue: queueRes.rows.map(mapQueueRow),
    beds: assignable,
    unstaffedFreeBeds: freeBeds.filter((bed) => !bed.staffed).length,
    load,
  };
}

function describeNextHead(queue, slots) {
  const next = queue[slots] || null;
  if (!next) {
    return {
      nextHead: null,
      nextNote:
        slots > 0
          ? 'Après cette affectation, la file d’attente sera vide.'
          : 'Personne en attente.',
    };
  }
  if (slots === 0) {
    return {
      nextHead: {
        visitId: next.visitId,
        publicCode: next.publicCode,
        patientName: next.patientName,
        priority: next.priority,
        previousRank: next.queuePosition,
      },
      nextNote: `${next.patientName} reste N1 : aucun lit libre avec équipe.`,
    };
  }
  return {
    nextHead: {
      visitId: next.visitId,
      publicCode: next.publicCode,
      patientName: next.patientName,
      priority: next.priority,
      previousRank: next.queuePosition,
    },
    nextNote: `N${next.queuePosition} devient N1 : ${next.patientName} attend le prochain lit.`,
  };
}

function buildRulePlacements(queue, beds, aiByVisit) {
  const slots = Math.min(queue.length, beds.length);
  const used = new Set();
  const placements = [];
  let usedAi = 0;
  let usedRules = 0;

  for (let index = 0; index < slots; index += 1) {
    const patient = queue[index];
    const suggested = aiByVisit.get(patient.visitId);
    const suggestedBed =
      suggested && beds.some((bed) => bed.bedId === suggested.bedId) && !used.has(suggested.bedId)
        ? beds.find((bed) => bed.bedId === suggested.bedId)
        : null;
    const bed = suggestedBed || pickBed(patient, beds, used);
    if (!bed) break;
    used.add(bed.bedId);
    const chosenBy = suggestedBed ? 'ia' : 'ordre';
    if (chosenBy === 'ia') usedAi += 1;
    else usedRules += 1;
    placements.push({
      rank: patient.queuePosition,
      visitId: patient.visitId,
      publicCode: patient.publicCode,
      patientName: patient.patientName,
      priority: patient.priority,
      criticalFlag: patient.criticalFlag,
      orientation: patient.orientation,
      bedId: bed.bedId,
      bedLabel: bed.label,
      roomName: bed.roomName,
      zoneName: bed.zoneName,
      doctorName: bed.doctorName,
      nurseCount: bed.nurseCount,
      rationale: suggestedBed
        ? suggested.rationale
        : `Ordre de file N${patient.queuePosition} vers ${bed.zoneName} · ${bed.label}, équipe ${bed.doctorName}.`,
      chosenBy,
    });
  }

  let source = 'ordre';
  if (usedAi > 0 && usedRules === 0) source = 'ia';
  else if (usedAi > 0 && usedRules > 0) source = 'mixte';

  const head = describeNextHead(queue, placements.length);
  return {
    source,
    slots: placements.length,
    placements,
    held: queue.slice(placements.length).map((patient) => ({
      rank: patient.queuePosition,
      visitId: patient.visitId,
      publicCode: patient.publicCode,
      patientName: patient.patientName,
      priority: patient.priority,
    })),
    ...head,
  };
}

function indexAiPlacements(aiPlacements) {
  const map = new Map();
  if (!Array.isArray(aiPlacements)) return map;
  for (const item of aiPlacements) {
    const visitId = Number(item?.visit_id);
    const bedId = Number(item?.bed_id);
    if (!Number.isFinite(visitId) || !Number.isFinite(bedId) || map.has(visitId)) continue;
    map.set(visitId, {
      bedId,
      rationale: typeof item.rationale === 'string' ? item.rationale : '',
    });
  }
  return map;
}

function fallbackSummary(queue, beds, decision) {
  if (queue.length === 0) return 'Aucun patient en attente à affecter.';
  if (beds.length === 0) return decision.nextNote;
  return `${decision.slots} patient(s) en tête de file peuvent entrer. ${decision.placements.length} lit(s) libre(s) avec équipe sur ${beds.length}. ${decision.nextNote}`;
}

async function planPipelinePlacement() {
  const settings = await getEffectiveAiSettings();
  assertAgentEnabled(settings, 'bedFlow');
  const snapshot = await loadPlacementSnapshot();
  const { queue, beds, load, unstaffedFreeBeds } = snapshot;
  const slots = Math.min(queue.length, beds.length);

  let aiSummary = null;
  let recommendationId = null;
  let runId = null;
  let aiWarning = null;
  let aiByVisit = new Map();

  if (slots > 0) {
    try {
      const ai = await recommendPipelinePlacement({
        slots,
        loadStatus: load.loadStatus,
        readyFreeBeds: beds.length,
        queue: queue.slice(0, 20).map((patient) => ({
          rank: patient.queuePosition,
          visitId: patient.visitId,
          publicCode: patient.publicCode,
          priority: patient.priority,
          critical: patient.criticalFlag,
          orientation: patient.orientation,
          complaint: patient.chiefComplaint,
          name: patient.patientName,
        })),
        beds: beds.slice(0, 40),
      });
      aiSummary = ai.output?.summary || null;
      recommendationId = ai.recommendation?.id || null;
      runId = ai.runId || null;
      aiByVisit = indexAiPlacements(ai.output?.placements);
    } catch (error) {
      aiWarning = error.message || 'Suggestion IA indisponible. Ordre de file et capacité appliqués.';
    }
  }

  const decision = buildRulePlacements(queue, beds, aiByVisit);
  if (decision.slots === 0 && unstaffedFreeBeds > 0 && queue[0]) {
    decision.nextNote = `${queue[0].patientName} reste N1 : des lits sont libres, mais aucune salle n’a à la fois un médecin et un infirmier.`;
  }
  return {
    ...decision,
    unstaffedFreeBeds,
    summary: aiSummary || fallbackSummary(queue, beds, decision),
    warning: aiWarning,
    loadStatus: load.loadStatus,
    readyFreeBeds: beds.length,
    queueLength: queue.length,
    recommendationId,
    runId,
    head: queue[0]
      ? {
          visitId: queue[0].visitId,
          publicCode: queue[0].publicCode,
          patientName: queue[0].patientName,
          priority: queue[0].priority,
        }
      : null,
  };
}

async function applyPipelinePlacement(actorUser, actionContext, body) {
  const submitted = Array.isArray(body?.placements) ? body.placements : [];
  if (submitted.length === 0) {
    throw { status: 400, message: 'Aucune affectation à valider.' };
  }

  const snapshot = await loadPlacementSnapshot();
  const visitIds = submitted.map((item) => Number(item.visitId));
  const bedIds = submitted.map((item) => Number(item.bedId));
  if (visitIds.some((id) => !Number.isFinite(id)) || bedIds.some((id) => !Number.isFinite(id))) {
    throw { status: 400, message: 'Affectation invalide.' };
  }

  const expected = snapshot.queue.slice(0, visitIds.length).map((patient) => patient.visitId);
  const orderMatches =
    expected.length === visitIds.length && expected.every((id, index) => id === visitIds[index]);
  if (!orderMatches) {
    throw {
      status: 409,
      message: 'La file a changé. Recalculez : le patient en tête n’est plus le même.',
    };
  }

  const freeIds = new Set(snapshot.beds.map((bed) => bed.bedId));
  const seenBeds = new Set();
  for (const bedId of bedIds) {
    if (!freeIds.has(bedId) || seenBeds.has(bedId)) {
      throw {
        status: 409,
        message: 'Un lit proposé n’est plus libre. Recalculez l’affectation.',
      };
    }
    seenBeds.add(bedId);
  }

  const placed = [];
  let failed = null;
  for (const item of submitted) {
    try {
      const result = await placeVisit(Number(item.visitId), Number(item.bedId), actorUser, {
        actorType: 'user',
        agentRunId: actionContext?.agentRunId || body?.runId || null,
      });
      placed.push({
        visitId: Number(item.visitId),
        bedId: Number(item.bedId),
        patientName: item.patientName || null,
        bedLabel: item.bedLabel || null,
        zoneName: item.zoneName || null,
        result,
      });
    } catch (error) {
      failed = {
        visitId: Number(item.visitId),
        message: error.message || 'Affectation interrompue.',
      };
      break;
    }
  }

  if (body?.recommendationId && placed.length === submitted.length && !failed) {
    const decisionText = placed
      .map((item) => `${item.visitId}->${item.bedId}`)
      .join(', ');
    try {
      await updateRecommendationStatus(body.recommendationId, {
        status: 'accepted',
        reviewedBy: actorUser?.id,
        humanDecision: decisionText,
      });
    } catch {
      // L'affectation clinique est déjà faite ; l'audit ne doit pas l'annuler.
    }
  }

  const after = await loadPlacementSnapshot();
  const head = after.queue[0] || null;
  return {
    placed,
    failed,
    nextHead: head
      ? {
          visitId: head.visitId,
          publicCode: head.publicCode,
          patientName: head.patientName,
          priority: head.priority,
          rank: 1,
        }
      : null,
    queueLength: after.queue.length,
    readyFreeBeds: after.beds.length,
  };
}

module.exports = {
  planPipelinePlacement,
  applyPipelinePlacement,
  buildRulePlacements,
  zoneMatches,
};
