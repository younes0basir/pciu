const { query, withTransaction } = require('../config/db');

const RESPONSIBLE_ROLES = ['doctor', 'chief'];

function idNum(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : value;
}

function personFrom(row, prefix) {
  const id = row[`${prefix}_id`];
  if (id == null) return null;
  return {
    id: idNum(id),
    firstName: row[`${prefix}_first_name`],
    lastName: row[`${prefix}_last_name`],
    email: row[`${prefix}_email`],
    role: row[`${prefix}_role`],
  };
}

async function getStaffBoard(client = { query }) {
  const roomsResult = await client.query(
    `SELECT
      z.id AS zone_id,
      z.name AS zone_name,
      z.color AS zone_color,
      z.display_order AS zone_order,
      r.id AS room_id,
      r.name AS room_name,
      r.display_order AS room_order,
      rt.id AS team_id,
      d.id AS doctor_id,
      d.first_name AS doctor_first_name,
      d.last_name AS doctor_last_name,
      d.email AS doctor_email,
      d.role AS doctor_role,
      (
        SELECT COUNT(*)::int
        FROM beds b
        WHERE b.room_id = r.id AND b.is_active = true
      ) AS beds_total,
      (
        SELECT COUNT(*)::int
        FROM beds b
        JOIN bed_assignments ba ON ba.bed_id = b.id AND ba.released_at IS NULL
        WHERE b.room_id = r.id
      ) AS beds_occupied
    FROM rooms r
    JOIN zones z ON z.id = r.zone_id
    LEFT JOIN room_teams rt ON rt.room_id = r.id
    LEFT JOIN users d ON d.id = rt.doctor_id
    WHERE r.is_active = true AND z.is_active = true
    ORDER BY z.display_order, z.id, r.display_order, r.id`
  );

  const nurseResult = await client.query(
    `SELECT
      rtn.room_team_id,
      u.id AS nurse_id,
      u.first_name AS nurse_first_name,
      u.last_name AS nurse_last_name,
      u.email AS nurse_email,
      u.role AS nurse_role
    FROM room_team_nurses rtn
    JOIN users u ON u.id = rtn.nurse_id
    ORDER BY u.last_name, u.first_name`
  );

  const staffResult = await client.query(
    `SELECT id, first_name, last_name, email, role
    FROM users
    WHERE is_active = true AND role IN ('doctor', 'nurse', 'chief')
    ORDER BY role, last_name, first_name`
  );

  const nursesByTeam = new Map();
  for (const row of nurseResult.rows) {
    const key = String(row.room_team_id);
    const list = nursesByTeam.get(key) || [];
    list.push({
      id: idNum(row.nurse_id),
      firstName: row.nurse_first_name,
      lastName: row.nurse_last_name,
      email: row.nurse_email,
      role: row.nurse_role,
    });
    nursesByTeam.set(key, list);
  }

  const zones = [];
  const zoneIndex = new Map();
  const roomByNurse = new Map();
  const roomByDoctor = new Map();

  for (const row of roomsResult.rows) {
    const zoneKey = String(row.zone_id);
    let zone = zoneIndex.get(zoneKey);
    if (!zone) {
      zone = {
        id: idNum(row.zone_id),
        name: row.zone_name,
        color: row.zone_color,
        rooms: [],
      };
      zoneIndex.set(zoneKey, zone);
      zones.push(zone);
    }

    const doctor = personFrom(row, 'doctor');
    const nurses = row.team_id ? nursesByTeam.get(String(row.team_id)) || [] : [];
    const room = {
      roomId: idNum(row.room_id),
      name: row.room_name,
      bedsTotal: row.beds_total,
      bedsOccupied: row.beds_occupied,
      doctor,
      nurses,
    };
    zone.rooms.push(room);

    if (doctor) {
      roomByDoctor.set(String(doctor.id), { roomId: room.roomId, roomName: room.name, zoneName: zone.name });
    }
    for (const nurse of nurses) {
      roomByNurse.set(String(nurse.id), { roomId: room.roomId, roomName: room.name, zoneName: zone.name });
    }
  }

  function withAssignment(person) {
    const assigned =
      person.role === 'nurse'
        ? roomByNurse.get(String(person.id))
        : roomByDoctor.get(String(person.id));
    return {
      id: idNum(person.id),
      firstName: person.first_name,
      lastName: person.last_name,
      email: person.email,
      role: person.role,
      assignedRoomId: assigned?.roomId ?? null,
      assignedRoomName: assigned?.roomName ?? null,
      assignedZoneName: assigned?.zoneName ?? null,
    };
  }

  const people = staffResult.rows.map(withAssignment);

  return {
    zones,
    clinicians: people.filter((person) => RESPONSIBLE_ROLES.includes(person.role)),
    nurses: people.filter((person) => person.role === 'nurse'),
  };
}

function normalizeNurseIds(nurseIds) {
  if (nurseIds == null) return [];
  if (!Array.isArray(nurseIds)) {
    throw { status: 400, message: 'La liste des infirmières est invalide.' };
  }
  const unique = [...new Set(nurseIds.map((id) => Number(id)))];
  if (unique.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw { status: 400, message: 'La liste des infirmières est invalide.' };
  }
  return unique;
}

async function assignRoomTeam(roomId, data, actorUser) {
  const numericRoomId = Number(roomId);
  const doctorId = Number(data?.doctorId);
  const nurseIds = normalizeNurseIds(data?.nurseIds);

  if (!Number.isInteger(numericRoomId) || numericRoomId <= 0) {
    throw { status: 400, message: 'Salle invalide.' };
  }
  if (!Number.isInteger(doctorId) || doctorId <= 0) {
    throw { status: 400, message: 'Choisissez le médecin responsable de la salle.' };
  }

  return withTransaction(async (client) => {
    const roomRes = await client.query(
      'SELECT id FROM rooms WHERE id = $1 AND is_active = true FOR UPDATE',
      [numericRoomId]
    );
    if (roomRes.rowCount === 0) {
      throw { status: 404, message: 'Salle introuvable.' };
    }

    const doctorRes = await client.query(
      'SELECT id, role, is_active FROM users WHERE id = $1 FOR UPDATE',
      [doctorId]
    );
    const doctor = doctorRes.rows[0];
    if (!doctor || !doctor.is_active || !RESPONSIBLE_ROLES.includes(doctor.role)) {
      throw {
        status: 400,
        message: 'Le responsable doit être un médecin actif, ou vous-même en tant que chef.',
      };
    }

    if (nurseIds.length > 0) {
      const nurseRes = await client.query(
        `SELECT id
         FROM users
         WHERE id = ANY($1::bigint[]) AND role = 'nurse' AND is_active = true`,
        [nurseIds]
      );
      if (nurseRes.rowCount !== nurseIds.length) {
        throw { status: 400, message: 'Une ou plusieurs infirmières sont inactives ou introuvables.' };
      }
    }

    // A clinician holds one room. Moving them uncovers the previous room.
    await client.query('DELETE FROM room_teams WHERE doctor_id = $1 AND room_id <> $2', [
      doctorId,
      numericRoomId,
    ]);

    if (nurseIds.length > 0) {
      await client.query('DELETE FROM room_team_nurses WHERE nurse_id = ANY($1::bigint[])', [nurseIds]);
    }

    const teamRes = await client.query(
      `INSERT INTO room_teams (room_id, doctor_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (room_id) DO UPDATE
         SET doctor_id = EXCLUDED.doctor_id,
             assigned_by = EXCLUDED.assigned_by,
             updated_at = NOW()
       RETURNING id`,
      [numericRoomId, doctorId, actorUser?.id || null]
    );
    const teamId = teamRes.rows[0].id;

    await client.query('DELETE FROM room_team_nurses WHERE room_team_id = $1', [teamId]);
    for (const nurseId of nurseIds) {
      await client.query(
        'INSERT INTO room_team_nurses (room_team_id, nurse_id) VALUES ($1, $2)',
        [teamId, nurseId]
      );
    }

    return getStaffBoard(client);
  });
}

async function clearRoomTeam(roomId) {
  const numericRoomId = Number(roomId);
  if (!Number.isInteger(numericRoomId) || numericRoomId <= 0) {
    throw { status: 400, message: 'Salle invalide.' };
  }

  return withTransaction(async (client) => {
    const roomRes = await client.query('SELECT id FROM rooms WHERE id = $1', [numericRoomId]);
    if (roomRes.rowCount === 0) {
      throw { status: 404, message: 'Salle introuvable.' };
    }
    await client.query('DELETE FROM room_teams WHERE room_id = $1', [numericRoomId]);
    return getStaffBoard(client);
  });
}

module.exports = {
  getStaffBoard,
  assignRoomTeam,
  clearRoomTeam,
};
