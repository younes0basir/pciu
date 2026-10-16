const { query } = require('../config/db');
const { getAllWorklists } = require('./queueService');
const { getReassessmentIntervalMinutes } = require('./workflowSettingsService');
const { upsertOpenAlert } = require('./operationalAlertService');
const { listResourcesWithStatus } = require('./resourceService');

function buildRecommendation(partial) {
  return {
    id: partial.id,
    type: partial.type,
    visitId: partial.visitId ?? null,
    bedId: partial.bedId ?? null,
    priority: partial.priority || 'medium',
    reasonCode: partial.reasonCode,
    explanation: partial.explanation,
    responsibleRole: partial.responsibleRole || 'nurse',
    action: partial.action,
    requiresHumanConfirmation: true,
    source: 'deterministic_rule',
    createdAt: new Date().toISOString(),
  };
}

async function computeRecommendationsForVisit(visitId) {
  const visitRes = await query(
    `SELECT v.id, v.care_stage, v.critical_flag, v.clinical_priority_validated_at,
            v.priority, ba.bed_id
     FROM visits v
     LEFT JOIN bed_assignments ba ON ba.visit_id = v.id AND ba.released_at IS NULL
     WHERE v.id = $1 AND v.closed_at IS NULL`,
    [visitId],
  );
  if (visitRes.rowCount === 0) return [];

  const v = visitRes.rows[0];
  const items = [];

  if (['registered', 'triage_pending'].includes(v.care_stage)) {
    items.push(
      buildRecommendation({
        id: `triage-${visitId}`,
        type: 'UNTRIAGED_PATIENT',
        visitId: Number(visitId),
        priority: v.critical_flag ? 'critical' : 'high',
        reasonCode: 'TRIAGE_REQUIRED',
        explanation: 'Triage clinique requis par personnel habilité.',
        responsibleRole: 'nurse',
        action: 'OPEN_TRIAGE',
      }),
    );
  }

  if (v.critical_flag) {
    items.push(
      buildRecommendation({
        id: `critical-${visitId}`,
        type: 'CRITICAL_ESCALATION',
        visitId: Number(visitId),
        priority: 'critical',
        reasonCode: 'CRITICAL_FLAG_SET',
        explanation: 'Signalement critique — escalade humaine requise (ne pas se limiter au rang de file).',
        responsibleRole: 'chief',
        action: 'OPEN_ESCALATION',
      }),
    );
  }

  if (v.care_stage === 'waiting_care' && v.clinical_priority_validated_at && !v.bed_id) {
    const readyBeds = await query(
      `SELECT COUNT(*)::int AS n FROM beds b
       LEFT JOIN bed_assignments ba ON ba.bed_id = b.id AND ba.released_at IS NULL
       WHERE b.is_active AND b.operational_status = 'ready' AND ba.id IS NULL`,
    );
    if (readyBeds.rows[0].n === 0) {
      items.push(
        buildRecommendation({
          id: `capacity-${visitId}`,
          type: 'CAPACITY_BLOCK',
          visitId: Number(visitId),
          priority: 'high',
          reasonCode: 'NO_READY_BED',
          explanation: 'Aucune ressource compatible prête — arbitrage capacité requis.',
          responsibleRole: 'chief',
          action: 'OPEN_CAPACITY',
        }),
      );
    }
  }

  return items;
}

async function syncDeterministicAlerts(client) {
  const worklists = await getAllWorklists();
  const interval = await getReassessmentIntervalMinutes();

  for (const row of worklists.triage) {
    await upsertOpenAlert(client, {
      alertType: 'UNTRIAGED_PATIENT',
      severity: row.criticalFlag ? 'critical' : 'medium',
      visitId: row.visitId,
      dedupeKey: `untriaged:${row.visitId}`,
      reasonCode: 'TRIAGE_REQUIRED',
      explanation: 'Patient en attente de triage clinique validé.',
      responsibleRole: 'nurse',
    });
  }

  for (const row of worklists.reassessment) {
    await upsertOpenAlert(client, {
      alertType: 'REASSESSMENT_DUE',
      severity: row.priority <= 2 ? 'high' : 'medium',
      visitId: row.visitId,
      dedupeKey: `reassessment:${row.visitId}`,
      reasonCode: 'REASSESSMENT_INTERVAL_EXCEEDED',
      explanation: `Réévaluation due (seuil configuré : ${interval} min).`,
      responsibleRole: 'nurse',
      metadata: { intervalMinutes: interval },
    });
  }

  const resources = await listResourcesWithStatus();
  for (const bed of resources) {
    if (bed.operationalStatus === 'cleaning' && !bed.occupied) {
      await upsertOpenAlert(client, {
        alertType: 'BED_TURNOVER_PENDING',
        severity: 'low',
        bedId: bed.bedId,
        dedupeKey: `bed-turnover:${bed.bedId}`,
        reasonCode: 'BED_CLEANING',
        explanation: 'Lit en nettoyage — confirmation de remise en service requise.',
        responsibleRole: 'nurse',
      });
    }
  }

  const roomsIncomplete = await query(
    `SELECT r.id, r.name, z.name AS zone_name
     FROM rooms r
     JOIN zones z ON z.id = r.zone_id
     LEFT JOIN room_teams rt ON rt.room_id = r.id
     WHERE r.is_active AND z.is_active
       AND (
         rt.id IS NULL
         OR rt.doctor_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM room_team_nurses rtn WHERE rtn.room_team_id = rt.id
         )
       )`,
  );
  for (const room of roomsIncomplete.rows) {
    await upsertOpenAlert(client, {
      alertType: 'ROOM_TEAM_INCOMPLETE',
      severity: 'medium',
      dedupeKey: `room-team:${room.id}`,
      reasonCode: 'ROOM_TEAM_INCOMPLETE',
      explanation: `Salle « ${room.name} » (${room.zone_name}) : équipe incomplète ou absente.`,
      responsibleRole: 'chief',
      metadata: { roomId: Number(room.id), roomName: room.name },
    });
  }

  const criticalWaiting = worklists.care.filter((r) => r.criticalFlag);
  for (const row of criticalWaiting) {
    await upsertOpenAlert(client, {
      alertType: 'CRITICAL_ESCALATION',
      severity: 'critical',
      visitId: row.visitId,
      dedupeKey: `critical-care:${row.visitId}`,
      reasonCode: 'CRITICAL_IN_QUEUE',
      explanation: 'Patient critique en attente de ressource ou de prise en charge.',
      responsibleRole: 'chief',
    });
  }
}

async function getSupervisionSnapshot() {
  const recommendations = [];
  const worklists = await getAllWorklists();

  for (const row of worklists.triage.slice(0, 50)) {
    recommendations.push(
      ...(await computeRecommendationsForVisit(row.visitId)),
    );
  }
  for (const row of worklists.reassessment.slice(0, 30)) {
    recommendations.push(
      buildRecommendation({
        id: `reassess-${row.visitId}`,
        type: 'REASSESSMENT_DUE',
        visitId: row.visitId,
        priority: row.priority <= 2 ? 'high' : 'medium',
        reasonCode: 'REASSESSMENT_INTERVAL_EXCEEDED',
        explanation: 'Réévaluation clinique due selon paramètres configurés.',
        responsibleRole: 'nurse',
        action: 'OPEN_REASSESSMENT',
      }),
    );
  }

  const deduped = [];
  const seen = new Set();
  for (const rec of recommendations) {
    if (seen.has(rec.id)) continue;
    seen.add(rec.id);
    deduped.push(rec);
  }

  const alerts = await query(
    `SELECT COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
            COUNT(*) FILTER (WHERE status = 'acknowledged')::int AS ack_count
     FROM operational_alerts`,
  );

  return {
    timestamp: new Date().toISOString(),
    recommendations: deduped,
    alertCounts: alerts.rows[0] || { open_count: 0, ack_count: 0 },
  };
}

module.exports = {
  buildRecommendation,
  computeRecommendationsForVisit,
  getSupervisionSnapshot,
  syncDeterministicAlerts,
};
