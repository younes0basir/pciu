const { query } = require('../config/db');
const { CHIEF_SLA, applyStuckFlags } = require('../config/chiefSla');

const TERMINAL_STATUSES = ['discharged', 'transferred', 'left_without_seen'];

function minutesBetween(fromIso, toDate = new Date()) {
  if (!fromIso) return null;
  const start = new Date(fromIso);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.round((toDate.getTime() - start.getTime()) / 60000));
}

function computeStepEnteredAt(row) {
  const status = row.status;
  if (status === 'waiting') {
    const called = Number(row.call_count) > 0 && row.last_called_at;
    return called ? row.last_called_at : row.arrived_at;
  }
  if (status === 'placed') {
    return row.bed_assigned_at || row.arrived_at;
  }
  if (status === 'in_treatment') {
    return row.consultation_started_at || row.bed_assigned_at || row.arrived_at;
  }
  return row.arrived_at;
}

function mapVisitRow(row, now = new Date(), { isClosed = false } = {}) {
  const stepEnteredAt = computeStepEnteredAt(row);
  const doctorName =
    row.doctor_first_name && row.doctor_last_name
      ? `Dr. ${row.doctor_first_name} ${row.doctor_last_name}`
      : null;

  const base = {
    visitId: row.visit_id,
    publicCode: row.public_code,
    patientName: `${row.first_name} ${row.last_name}`,
    nationalId: row.national_id,
    priority: row.priority,
    chiefComplaint: row.chief_complaint,
    status: row.status,
    arrivedAt: row.arrived_at,
    lastCalledAt: row.last_called_at,
    callCount: Number(row.call_count),
    stepEnteredAt,
    minutesInStep: minutesBetween(stepEnteredAt, now),
    minutesSinceArrival: minutesBetween(row.arrived_at, now),
    bedLabel: row.bed_label || null,
    zoneName: row.zone_name || null,
    doctorName,
    closedAt: row.closed_at || null,
    outcome: TERMINAL_STATUSES.includes(row.status) ? row.status : null,
  };

  if (isClosed && row.closed_at) {
    base.minutesDoorToDischarge = minutesBetween(row.arrived_at, new Date(row.closed_at));
    base.minutesDoorToDoctor = row.first_consult_started_at
      ? minutesBetween(row.arrived_at, new Date(row.first_consult_started_at))
      : null;
  }

  return base;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

async function getChiefOverview() {
  const now = new Date();

  const activeResult = await query(
    `SELECT 
      v.id AS visit_id,
      v.public_code,
      v.status,
      v.priority,
      v.chief_complaint,
      v.arrived_at,
      v.last_called_at,
      v.call_count,
      v.closed_at,
      p.first_name,
      p.last_name,
      p.national_id,
      ba.assigned_at AS bed_assigned_at,
      b.label AS bed_label,
      z.name AS zone_name,
      c.started_at AS consultation_started_at,
      u.first_name AS doctor_first_name,
      u.last_name AS doctor_last_name
    FROM visits v
    JOIN patients p ON p.id = v.patient_id
    LEFT JOIN bed_assignments ba ON ba.visit_id = v.id AND ba.released_at IS NULL
    LEFT JOIN beds b ON b.id = ba.bed_id
    LEFT JOIN rooms r ON r.id = b.room_id
    LEFT JOIN zones z ON z.id = r.zone_id
    LEFT JOIN LATERAL (
      SELECT c2.started_at, c2.doctor_id
      FROM consultations c2
      WHERE c2.visit_id = v.id AND c2.ended_at IS NULL
      ORDER BY c2.started_at DESC
      LIMIT 1
    ) c ON TRUE
    LEFT JOIN users u ON u.id = c.doctor_id
    WHERE v.status IN ('waiting', 'placed', 'in_treatment')
    ORDER BY v.priority ASC, v.arrived_at ASC`
  );

  const closedResult = await query(
    `SELECT 
      v.id AS visit_id,
      v.public_code,
      v.status,
      v.priority,
      v.chief_complaint,
      v.arrived_at,
      v.last_called_at,
      v.call_count,
      v.closed_at,
      p.first_name,
      p.last_name,
      p.national_id,
      NULL::timestamptz AS bed_assigned_at,
      NULL::text AS bed_label,
      NULL::text AS zone_name,
      NULL::timestamptz AS consultation_started_at,
      NULL::text AS doctor_first_name,
      NULL::text AS doctor_last_name,
      cons.first_consult_started_at
    FROM visits v
    JOIN patients p ON p.id = v.patient_id
    LEFT JOIN LATERAL (
      SELECT MIN(c2.started_at) AS first_consult_started_at
      FROM consultations c2
      WHERE c2.visit_id = v.id
    ) cons ON TRUE
    WHERE v.status = ANY($1::text[])
      AND v.closed_at IS NOT NULL
      AND v.closed_at >= CURRENT_DATE
    ORDER BY v.closed_at DESC
    LIMIT 100`,
    [TERMINAL_STATUSES]
  );

  const bedsResult = await query(
    `SELECT 
      zone_id,
      zone_name,
      zone_color,
      room_id,
      room_name,
      bed_id,
      bed_label,
      occupied,
      visit_id,
      public_code,
      visit_status,
      priority,
      first_name,
      last_name,
      assigned_at
    FROM bed_board
    ORDER BY zone_id, room_id, bed_id`
  );

  const pipeline = {
    waitingUncalled: [],
    waitingCalled: [],
    placed: [],
    inTreatment: [],
  };

  const activeCards = activeResult.rows
    .map((row) => mapVisitRow(row, now))
    .map((card) => applyStuckFlags(card, CHIEF_SLA));

  for (const card of activeCards) {
    if (card.status === 'waiting') {
      if (card.callCount > 0 && card.lastCalledAt) {
        pipeline.waitingCalled.push(card);
      } else {
        pipeline.waitingUncalled.push(card);
      }
    } else if (card.status === 'placed') {
      pipeline.placed.push(card);
    } else if (card.status === 'in_treatment') {
      pipeline.inTreatment.push(card);
    }
  }

  const closedToday = closedResult.rows.map((row) =>
    mapVisitRow(
      {
        ...row,
        first_consult_started_at: row.first_consult_started_at,
      },
      now,
      { isClosed: true }
    )
  );

  const stuckAlerts = activeCards
    .filter((c) => c.stuckLevel !== 'none')
    .sort((a, b) => (b.minutesInStep ?? 0) - (a.minutesInStep ?? 0));

  const zoneSet = new Set();
  for (const b of bedsResult.rows) {
    if (b.zone_name) zoneSet.add(b.zone_name);
  }
  for (const c of activeCards) {
    if (c.zoneName) zoneSet.add(c.zoneName);
  }
  const zones = [...zoneSet].sort((a, b) => a.localeCompare(b, 'fr'));

  const waitMinutes = activeCards
    .map((c) => c.minutesSinceArrival)
    .filter((m) => m != null);

  const beds = bedsResult.rows.map((row) => ({
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    zoneColor: row.zone_color,
    roomId: row.room_id,
    roomName: row.room_name,
    bedId: row.bed_id,
    bedLabel: row.bed_label,
    occupied: Boolean(row.occupied),
    visitId: row.visit_id,
    publicCode: row.public_code,
    visitStatus: row.visit_status,
    priority: row.priority,
    patientName: row.first_name ? `${row.first_name} ${row.last_name}` : null,
    assignedAt: row.assigned_at,
  }));

  const bedsOccupied = beds.filter((b) => b.occupied).length;
  const bedsFree = beds.length - bedsOccupied;

  return {
    stats: {
      active: activeCards.length,
      priority12: activeCards.filter((c) => c.priority <= 2).length,
      medianWaitMinutes: median(waitMinutes),
      bedsOccupied,
      bedsFree,
      bedsTotal: beds.length,
      closedToday: closedToday.length,
      stuckCount: stuckAlerts.length,
    },
    sla: { ...CHIEF_SLA },
    zones,
    activeAll: activeCards,
    stuckAlerts,
    pipeline,
    closedToday,
    beds,
    timestamp: now.toISOString(),
  };
}

module.exports = {
  getChiefOverview,
};
