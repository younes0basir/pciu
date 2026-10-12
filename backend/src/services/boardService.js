const { query } = require('../config/db');
const { getCapabilities } = require('../config/roles');

async function getBoardSnapshot(currentUser) {
  // 1. Fetch waiting board from the SQL view
  const waitingResult = await query(
    `SELECT 
      visit_id,
      public_code,
      priority,
      care_stage,
      critical_flag,
      current_orientation,
      queue_position,
      chief_complaint,
      arrived_at,
      last_called_at,
      call_count,
      patient_id,
      first_name,
      last_name,
      national_id
    FROM waiting_board
    ORDER BY queue_position ASC`
  );

  // 2. Fetch bed board from the SQL view
  const bedsResult = await query(
    `SELECT 
      zone_id,
      zone_name,
      zone_color,
      room_id,
      room_name,
      bed_id,
      bed_label,
      resource_type,
      operational_status,
      occupied,
      care_stage,
      critical_flag,
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

  return {
    currentUser: currentUser
      ? {
          id: currentUser.id,
          name: `${currentUser.first_name} ${currentUser.last_name}`,
          role: currentUser.role,
          capabilities: getCapabilities(currentUser.role),
        }
      : null,
    waiting: waitingResult.rows.map((row) => ({
      visitId: row.visit_id,
      publicCode: row.public_code,
      priority: row.priority,
      careStage: row.care_stage,
      criticalFlag: Boolean(row.critical_flag),
      orientation: row.current_orientation,
      queuePosition: Number(row.queue_position),
      chiefComplaint: row.chief_complaint,
      arrivedAt: row.arrived_at,
      lastCalledAt: row.last_called_at,
      callCount: Number(row.call_count),
      patientId: row.patient_id,
      patientName: `${row.first_name} ${row.last_name}`,
      nationalId: row.national_id,
      isCalled: Boolean(row.last_called_at && row.call_count > 0),
    })),
    beds: bedsResult.rows.map((row) => ({
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      zoneColor: row.zone_color,
      roomId: row.room_id,
      roomName: row.room_name,
      bedId: row.bed_id,
      bedLabel: row.bed_label,
      resourceType: row.resource_type,
      operationalStatus: row.operational_status,
      occupied: Boolean(row.occupied),
      careStage: row.care_stage,
      criticalFlag: Boolean(row.critical_flag),
      visitId: row.visit_id,
      publicCode: row.public_code,
      visitStatus: row.visit_status,
      priority: row.priority,
      patientName: row.first_name ? `${row.first_name} ${row.last_name}` : null,
      assignedAt: row.assigned_at,
    })),
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getBoardSnapshot,
};
