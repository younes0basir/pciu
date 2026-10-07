const { query } = require('../config/db');

async function getAvailableBeds() {
  const result = await query(
    `SELECT 
      b.id AS bed_id,
      b.label AS bed_label,
      r.id AS room_id,
      r.name AS room_name,
      z.id AS zone_id,
      z.name AS zone_name,
      z.color AS zone_color
    FROM beds b
    JOIN rooms r ON r.id = b.room_id
    JOIN zones z ON z.id = r.zone_id
    LEFT JOIN bed_assignments ba ON ba.bed_id = b.id AND ba.released_at IS NULL
    WHERE b.is_active = true 
      AND r.is_active = true 
      AND z.is_active = true 
      AND ba.id IS NULL
    ORDER BY z.display_order ASC, r.display_order ASC, b.display_order ASC, b.label ASC`
  );

  return result.rows.map((row) => ({
    bedId: row.bed_id,
    bedLabel: row.bed_label,
    roomId: row.room_id,
    roomName: row.room_name,
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    zoneColor: row.zone_color,
  }));
}

module.exports = {
  getAvailableBeds,
};
