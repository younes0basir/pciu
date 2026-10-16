const { query } = require('../../config/db');
const { buildTriageContext } = require('./triage-context-builder');

async function buildBedFlowContext(visitId) {
  const triage = await buildTriageContext(visitId);
  const bedsRes = await query(
    `SELECT b.id, b.label, b.operational_status, r.name AS room_name, z.name AS zone_name
     FROM beds b
     JOIN rooms r ON r.id = b.room_id
     JOIN zones z ON z.id = r.zone_id
     WHERE b.operational_status = 'ready'
       AND NOT EXISTS (
         SELECT 1 FROM bed_assignments ba
         WHERE ba.bed_id = b.id AND ba.released_at IS NULL
       )
     ORDER BY z.name, r.name, b.label
     LIMIT 40`,
  );
  return {
    triage,
    availableBeds: bedsRes.rows.map((b) => ({
      bedId: Number(b.id),
      label: b.label,
      roomName: b.room_name,
      zoneName: b.zone_name,
    })),
  };
}

module.exports = {
  buildBedFlowContext,
};
