const { getAllWorklists } = require('./queueService');
const { listResourcesWithStatus } = require('./resourceService');
const { query } = require('../config/db');
const { minutesSince } = require('./supervisionRulesService');

function buildMeta(scope = 'chief') {
  return {
    generatedAt: new Date().toISOString(),
    scope,
    dataFreshness: 'current',
    rulesVersion: 'v4-supervision-draft',
  };
}

function countReadyBeds(resources) {
  return resources.filter(
    (b) => b.isActive !== false && b.operationalStatus === 'ready' && !b.occupied,
  ).length;
}

function countOccupiedBeds(resources) {
  return resources.filter((b) => b.occupied).length;
}

async function getSupervisionOverview({ zoneName = null } = {}) {
  const [worklists, resources] = await Promise.all([
    getAllWorklists(),
    listResourcesWithStatus(),
  ]);

  const filterZone = (rows) => {
    if (!zoneName || zoneName === 'all') return rows;
    return rows.filter((r) => r.zoneName === zoneName);
  };

  const triage = filterZone(worklists.triage);
  const care = filterZone(worklists.care);
  const inCare = filterZone(worklists.inCare);
  const observation = filterZone(worklists.observation);
  const disposition = filterZone(worklists.disposition);
  const reassessment = filterZone(worklists.reassessment);
  const exams = filterZone(worklists.exams);

  const activeVisitIds = new Set();
  for (const list of [triage, care, inCare, observation, disposition, reassessment]) {
    for (const row of list) activeVisitIds.add(row.visitId);
  }

  const bedsFiltered =
    zoneName && zoneName !== 'all'
      ? resources.filter((b) => b.zoneName === zoneName)
      : resources;

  const alertCountsRes = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
       COUNT(*) FILTER (WHERE status = 'acknowledged')::int AS ack_count,
       COUNT(*) FILTER (WHERE status IN ('open', 'acknowledged'))::int AS active_count
     FROM operational_alerts`,
  );
  const alertCounts = alertCountsRes.rows[0] || {
    open_count: 0,
    ack_count: 0,
    active_count: 0,
  };

  const kpis = {
    activePatients: activeVisitIds.size,
    awaitingTriage: triage.length,
    awaitingCare: care.length,
    inCare: inCare.length,
    inObservation: observation.length,
    dispositionPending: disposition.length,
    reassessmentDue: reassessment.length,
    examsPending: exams.length,
    openAlerts: Number(alertCounts.open_count) || 0,
    acknowledgedAlerts: Number(alertCounts.ack_count) || 0,
    bedsReady: countReadyBeds(bedsFiltered),
    bedsOccupied: countOccupiedBeds(bedsFiltered),
    bedsTotal: bedsFiltered.filter((b) => b.isActive !== false).length,
    bedsCleaning: bedsFiltered.filter((b) => b.operationalStatus === 'cleaning').length,
  };

  return {
    data: { kpis, worklistTimestamp: worklists.timestamp },
    meta: buildMeta(),
  };
}

async function getSupervisionPipeline({ zoneName = null } = {}) {
  const worklists = await getAllWorklists();
  const now = new Date();

  const filterZone = (rows) => {
    if (!zoneName || zoneName === 'all') return rows;
    return rows.filter((r) => r.zoneName === zoneName);
  };

  const stages = [
    { key: 'triage', label: 'Triage', rows: filterZone(worklists.triage) },
    { key: 'care', label: 'Attente soins', rows: filterZone(worklists.care) },
    { key: 'inCare', label: 'En soins', rows: filterZone(worklists.inCare) },
    { key: 'observation', label: 'Observation', rows: filterZone(worklists.observation) },
    { key: 'disposition', label: 'Disposition', rows: filterZone(worklists.disposition) },
  ];

  const pipeline = stages.map((stage) => {
    const waitMinutes = stage.rows
      .map((r) => minutesSince(r.arrivedAt, now))
      .filter((m) => m != null);
    waitMinutes.sort((a, b) => a - b);
    const median =
      waitMinutes.length === 0
        ? null
        : waitMinutes.length % 2 === 0
          ? Math.round(
              (waitMinutes[waitMinutes.length / 2 - 1] + waitMinutes[waitMinutes.length / 2]) / 2,
            )
          : waitMinutes[Math.floor(waitMinutes.length / 2)];

    return {
      key: stage.key,
      label: stage.label,
      count: stage.rows.length,
      sampleSize: waitMinutes.length,
      medianWaitMinutesSinceArrival: median,
      visitIds: stage.rows.slice(0, 50).map((r) => r.visitId),
    };
  });

  return {
    data: { pipeline, examsPending: filterZone(worklists.exams).length },
    meta: buildMeta(),
  };
}

async function getSupervisionCapacity({ zoneName = null } = {}) {
  const resources = await listResourcesWithStatus();
  const filtered =
    zoneName && zoneName !== 'all'
      ? resources.filter((b) => b.zoneName === zoneName)
      : resources;

  const byZone = new Map();
  for (const bed of filtered) {
    const z = bed.zoneName || 'Sans zone';
    if (!byZone.has(z)) {
      byZone.set(z, {
        zoneName: z,
        total: 0,
        ready: 0,
        occupied: 0,
        cleaning: 0,
        maintenance: 0,
        blocked: 0,
        outOfService: 0,
      });
    }
    const bucket = byZone.get(z);
    if (bed.isActive === false) continue;
    bucket.total += 1;
    if (bed.occupied) bucket.occupied += 1;
    else if (bed.operationalStatus === 'ready') bucket.ready += 1;
    else if (bed.operationalStatus === 'cleaning') bucket.cleaning += 1;
    else if (bed.operationalStatus === 'maintenance') bucket.maintenance += 1;
    else if (bed.operationalStatus === 'blocked') bucket.blocked += 1;
    else if (bed.operationalStatus === 'out_of_service') bucket.outOfService += 1;
  }

  return {
    data: {
      zones: Array.from(byZone.values()),
      totals: {
        ready: countReadyBeds(filtered),
        occupied: countOccupiedBeds(filtered),
        total: filtered.filter((b) => b.isActive !== false).length,
      },
    },
    meta: buildMeta(),
  };
}

async function getSupervisionActivity({ limit = 30 } = {}) {
  const capped = Math.min(100, Math.max(1, Number(limit) || 30));
  const res = await query(
    `SELECT ve.id, ve.visit_id, ve.event_type, ve.created_at, v.public_code
     FROM visit_events ve
     LEFT JOIN visits v ON v.id = ve.visit_id
     ORDER BY ve.id DESC
     LIMIT $1`,
    [capped],
  );

  return {
    data: {
      events: res.rows.map((row) => ({
        id: Number(row.id),
        visitId: row.visit_id ? Number(row.visit_id) : null,
        publicCode: row.public_code || null,
        eventType: row.event_type,
        createdAt: row.created_at,
      })),
    },
    meta: buildMeta(),
  };
}

module.exports = {
  buildMeta,
  getSupervisionOverview,
  getSupervisionPipeline,
  getSupervisionCapacity,
  getSupervisionActivity,
};
