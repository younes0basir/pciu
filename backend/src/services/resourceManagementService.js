const { query } = require('../config/db');
const { listResourcesWithStatus } = require('./resourceService');

const BLOCKED_OPERATIONAL = ['maintenance', 'blocked', 'out_of_service'];

function isImmediatelyAvailable(resource) {
  return (
    resource.occupied !== true &&
    resource.operationalStatus === 'ready' &&
    !BLOCKED_OPERATIONAL.includes(resource.operationalStatus)
  );
}

function computeMetrics(resources) {
  const active = resources.filter((r) => r.isActive !== false);
  const occupied = active.filter((r) => r.occupied).length;
  const readyFree = active.filter((r) => isImmediatelyAvailable(r)).length;
  const cleaning = active.filter((r) => r.operationalStatus === 'cleaning' && !r.occupied).length;
  const maintenance = active.filter((r) => r.operationalStatus === 'maintenance').length;
  const blocked = active.filter((r) => r.operationalStatus === 'blocked').length;
  const outOfService = active.filter((r) => r.operationalStatus === 'out_of_service').length;

  return {
    totalActive: active.length,
    occupied,
    immediatelyAvailable: readyFree,
    cleaning,
    maintenance,
    blocked,
    outOfService,
    occupancyRate: active.length ? occupied / active.length : 0,
  };
}

function buildZoneRoomTree(resources) {
  const zoneMap = new Map();

  for (const r of resources) {
    const zoneKey = String(r.zoneId ?? r.zoneName);
    let zone = zoneMap.get(zoneKey);
    if (!zone) {
      zone = {
        zoneId: r.zoneId,
        zoneName: r.zoneName,
        zoneColor: r.zoneColor,
        rooms: [],
        roomMap: new Map(),
        metrics: {
          totalActive: 0,
          occupied: 0,
          immediatelyAvailable: 0,
          cleaning: 0,
        },
      };
      zoneMap.set(zoneKey, zone);
    }

    zone.metrics.totalActive += 1;
    if (r.occupied) zone.metrics.occupied += 1;
    if (isImmediatelyAvailable(r)) zone.metrics.immediatelyAvailable += 1;
    if (r.operationalStatus === 'cleaning' && !r.occupied) zone.metrics.cleaning += 1;

    const roomKey = String(r.roomId ?? r.roomName);
    let room = zone.roomMap.get(roomKey);
    if (!room) {
      room = {
        roomId: r.roomId,
        roomName: r.roomName,
        teamDoctorName: r.teamDoctorName ?? null,
        nurseCount: r.nurseCount ?? 0,
        staffed: Boolean(r.teamDoctorName) && (r.nurseCount ?? 0) > 0,
        resources: [],
      };
      zone.roomMap.set(roomKey, room);
      zone.rooms.push(room);
    }
    room.resources.push(r);
  }

  return [...zoneMap.values()].map(({ roomMap: _rm, ...z }) => z);
}

async function loadResourcesEnriched() {
  const result = await query(
    `SELECT
      b.id AS bed_id,
      b.label AS bed_label,
      b.resource_type,
      b.operational_status,
      b.is_active,
      r.id AS room_id,
      r.name AS room_name,
      z.id AS zone_id,
      z.name AS zone_name,
      z.color AS zone_color,
      ba.visit_id,
      ba.assigned_at,
      v.public_code,
      v.care_stage,
      v.priority,
      d.first_name AS doctor_first_name,
      d.last_name AS doctor_last_name,
      (
        SELECT COUNT(*)::int
        FROM room_team_nurses rtn
        JOIN users nu ON nu.id = rtn.nurse_id AND nu.is_active = true
        WHERE rtn.room_team_id = rt.id
      ) AS nurse_count,
      (
        SELECT rse.created_at
        FROM resource_status_events rse
        WHERE rse.bed_id = b.id
        ORDER BY rse.created_at DESC
        LIMIT 1
      ) AS last_status_change_at
    FROM beds b
    JOIN rooms r ON r.id = b.room_id
    JOIN zones z ON z.id = r.zone_id
    LEFT JOIN room_teams rt ON rt.room_id = r.id
    LEFT JOIN users d ON d.id = rt.doctor_id AND d.is_active = true
    LEFT JOIN bed_assignments ba ON ba.bed_id = b.id AND ba.released_at IS NULL
    LEFT JOIN visits v ON v.id = ba.visit_id
    WHERE b.is_active AND r.is_active AND z.is_active
    ORDER BY z.display_order, r.display_order, b.display_order, b.label`,
  );

  return result.rows.map((row) => {
    const teamDoctorName =
      row.doctor_first_name != null
        ? `${row.doctor_first_name} ${row.doctor_last_name}`.trim()
        : null;
    return {
      bedId: row.bed_id,
      bedLabel: row.bed_label,
      resourceType: row.resource_type,
      operationalStatus: row.operational_status,
      isActive: row.is_active,
      occupied: Boolean(row.visit_id),
      visitId: row.visit_id,
      publicCode: row.public_code,
      careStage: row.care_stage,
      priority: row.priority,
      assignedAt: row.assigned_at,
      roomId: row.room_id,
      roomName: row.room_name,
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      zoneColor: row.zone_color,
      teamDoctorName,
      nurseCount: Number(row.nurse_count || 0),
      staffed: Boolean(teamDoctorName) && Number(row.nurse_count || 0) > 0,
      lastStatusChangeAt: row.last_status_change_at,
    };
  });
}

async function getResourceBoard() {
  const resources = await loadResourcesEnriched();
  return {
    timestamp: new Date().toISOString(),
    metrics: computeMetrics(resources),
    zones: buildZoneRoomTree(resources),
    resources,
  };
}

async function getResourceDetail(bedId) {
  const resources = await loadResourcesEnriched();
  const resource = resources.find((r) => Number(r.bedId) === Number(bedId));
  if (!resource) {
    throw { status: 404, message: 'Ressource introuvable.' };
  }
  return {
    resource,
    immediatelyAvailable: isImmediatelyAvailable(resource),
  };
}

async function getResourceHistory(bedId, { limit = 50, offset = 0 } = {}) {
  const lim = Math.min(100, Math.max(1, limit));
  const off = Math.max(0, offset);

  const bedCheck = await query(`SELECT id FROM beds WHERE id = $1`, [bedId]);
  if (bedCheck.rowCount === 0) {
    throw { status: 404, message: 'Ressource introuvable.' };
  }

  const history = await query(
    `SELECT rse.id, rse.from_status, rse.to_status, rse.note, rse.created_at,
            u.first_name, u.last_name
     FROM resource_status_events rse
     LEFT JOIN users u ON u.id = rse.actor_user_id
     WHERE rse.bed_id = $1
     ORDER BY rse.created_at DESC, rse.id DESC
     LIMIT $2 OFFSET $3`,
    [bedId, lim, off],
  );

  return {
    bedId: Number(bedId),
    events: history.rows.map((row) => ({
      id: Number(row.id),
      fromStatus: row.from_status,
      toStatus: row.to_status,
      note: row.note,
      createdAt: row.created_at,
      actorName:
        row.first_name != null ? `${row.first_name} ${row.last_name}`.trim() : null,
    })),
    limit: lim,
    offset: off,
  };
}

function buildEligibilityReasons(resource, { staffedOnly }) {
  const reasons = [];
  const warnings = [];

  if (resource.occupied) {
    return { eligible: false, reasons: ['Affectation active sur cette ressource'], warnings };
  }
  if (BLOCKED_OPERATIONAL.includes(resource.operationalStatus)) {
    return {
      eligible: false,
      reasons: [`État opérationnel : ${resource.operationalStatus}`],
      warnings,
    };
  }
  if (resource.operationalStatus !== 'ready') {
    return {
      eligible: false,
      reasons: [`Ressource non prête (${resource.operationalStatus})`],
      warnings,
    };
  }

  reasons.push('État prêt', 'Aucune affectation active');
  if (staffedOnly && !resource.staffed) {
    warnings.push('Salle sans équipe complète (médecin titulaire et infirmiers)');
  }
  if (!resource.teamDoctorName) {
    warnings.push('Aucun médecin titulaire affecté à la salle');
  }

  return { eligible: true, reasons, warnings };
}

async function listEligibleResourcesForVisit(visitId, { staffedOnly = false } = {}) {
  const visitRes = await query(
    `SELECT id, care_stage, closed_at, current_orientation
     FROM visits WHERE id = $1`,
    [visitId],
  );
  if (visitRes.rowCount === 0) {
    throw { status: 404, message: 'Visite introuvable.' };
  }
  const visit = visitRes.rows[0];
  if (visit.closed_at || visit.care_stage === 'completed') {
    throw { status: 400, message: 'Visite terminée.' };
  }

  const occupied = await query(
    `SELECT bed_id FROM bed_assignments WHERE visit_id = $1 AND released_at IS NULL`,
    [visitId],
  );
  if (occupied.rowCount > 0) {
    throw { status: 409, message: 'Le patient a déjà une ressource active.' };
  }

  const resources = await loadResourcesEnriched();
  const candidates = [];

  for (const resource of resources) {
    const { eligible, reasons, warnings } = buildEligibilityReasons(resource, { staffedOnly });
    if (!eligible) continue;
    if (staffedOnly && !resource.staffed) continue;

    const roomLoad = resources.filter(
      (r) => r.roomId === resource.roomId && r.occupied,
    ).length;

    candidates.push({
      bedId: resource.bedId,
      bedLabel: resource.bedLabel,
      roomName: resource.roomName,
      zoneName: resource.zoneName,
      resourceType: resource.resourceType,
      operationalStatus: resource.operationalStatus,
      staffed: resource.staffed,
      teamDoctorName: resource.teamDoctorName,
      nurseCount: resource.nurseCount,
      roomOccupiedCount: roomLoad,
      reasons,
      warnings,
    });
  }

  candidates.sort((a, b) => {
    if (a.roomOccupiedCount !== b.roomOccupiedCount) {
      return a.roomOccupiedCount - b.roomOccupiedCount;
    }
    if (a.zoneName !== b.zoneName) {
      return String(a.zoneName).localeCompare(String(b.zoneName), 'fr');
    }
    if (a.roomName !== b.roomName) {
      return String(a.roomName).localeCompare(String(b.roomName), 'fr');
    }
    return a.bedId - b.bedId;
  });

  return {
    visitId: Number(visitId),
    orientation: visit.current_orientation,
    timestamp: new Date().toISOString(),
    suggestions: candidates,
    summary:
      candidates.length === 0
        ? {
            state: 'none_available',
            explanation:
              'Aucune ressource immédiatement disponible (prête et libre). Escalade humaine requise.',
          }
        : { state: 'ok', count: candidates.length },
  };
}

async function getCapacitySnapshot() {
  const resources = await loadResourcesEnriched();
  const metrics = computeMetrics(resources);

  const waitingBed = await query(
    `SELECT COUNT(*)::int AS n FROM visits
     WHERE closed_at IS NULL AND care_stage = 'waiting_care'
       AND NOT EXISTS (
         SELECT 1 FROM bed_assignments ba
         WHERE ba.visit_id = visits.id AND ba.released_at IS NULL
       )`,
  );

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      ...metrics,
      patientsWaitingForBed: waitingBed.rows[0]?.n ?? 0,
    },
    zones: buildZoneRoomTree(resources).map((z) => ({
      zoneId: z.zoneId,
      zoneName: z.zoneName,
      metrics: z.metrics,
    })),
  };
}

async function detectResourceInconsistencies() {
  const rows = await query(
    `SELECT b.id, b.operational_status, ba.visit_id
     FROM beds b
     LEFT JOIN bed_assignments ba ON ba.bed_id = b.id AND ba.released_at IS NULL
     WHERE b.is_active
       AND (
         (ba.visit_id IS NOT NULL AND b.operational_status IN ('maintenance', 'blocked', 'out_of_service'))
         OR (ba.visit_id IS NULL AND b.operational_status = 'ready' AND EXISTS (
           SELECT 1 FROM bed_assignments ba2
           WHERE ba2.bed_id = b.id AND ba2.released_at IS NULL
         ))
       )`,
  );
  return rows.rows.map((row) => ({
    bedId: row.id,
    operationalStatus: row.operational_status,
    visitId: row.visit_id,
  }));
}

module.exports = {
  getResourceBoard,
  getResourceDetail,
  getResourceHistory,
  listEligibleResourcesForVisit,
  getCapacitySnapshot,
  detectResourceInconsistencies,
  isImmediatelyAvailable,
  computeMetrics,
  loadResourcesEnriched,
};
