async function getActiveVisitBedRoom(client, visitId) {
  const res = await client.query(
    `SELECT
      r.id AS room_id,
      r.name AS room_name,
      z.name AS zone_name,
      rt.doctor_id
     FROM bed_assignments ba
     JOIN beds b ON b.id = ba.bed_id
     JOIN rooms r ON r.id = b.room_id
     JOIN zones z ON z.id = r.zone_id
     LEFT JOIN room_teams rt ON rt.room_id = r.id
     WHERE ba.visit_id = $1 AND ba.released_at IS NULL
     LIMIT 1`,
    [visitId]
  );
  return res.rows[0] || null;
}

async function isNurseAssignedToRoom(client, nurseId, roomId) {
  const res = await client.query(
    `SELECT 1
     FROM room_team_nurses rtn
     JOIN room_teams rt ON rt.id = rtn.room_team_id
     WHERE rtn.nurse_id = $1 AND rt.room_id = $2
     LIMIT 1`,
    [nurseId, roomId]
  );
  return res.rowCount > 0;
}

async function assertNurseCanManageVisit(client, actorUser, visitId) {
  const bedRoom = await getActiveVisitBedRoom(client, visitId);
  if (!bedRoom) {
    throw { status: 400, message: 'Aucun lit actif pour cette visite.' };
  }
  const allowed = await isNurseAssignedToRoom(client, actorUser.id, bedRoom.room_id);
  if (!allowed) {
    throw { status: 403, message: 'Cette visite n’est pas dans votre salle.' };
  }
  return bedRoom;
}

async function assertDoctorCanManageVisit(client, actorUser, visitId) {
  const bedRoom = await getActiveVisitBedRoom(client, visitId);
  if (bedRoom?.doctor_id && Number(bedRoom.doctor_id) === Number(actorUser.id)) {
    return bedRoom;
  }

  const consultRes = await client.query(
    `SELECT doctor_id FROM consultations WHERE visit_id = $1 AND ended_at IS NULL LIMIT 1`,
    [visitId]
  );
  const consult = consultRes.rows[0];
  if (consult && Number(consult.doctor_id) === Number(actorUser.id)) {
    return bedRoom;
  }

  throw { status: 403, message: 'Cette visite n’est pas sous votre responsabilité.' };
}

module.exports = {
  getActiveVisitBedRoom,
  isNurseAssignedToRoom,
  assertNurseCanManageVisit,
  assertDoctorCanManageVisit,
};
