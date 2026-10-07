const { getCapabilities } = require('../config/roles');
const { getBoardSnapshot } = require('./boardService');
const { getStaffBoard } = require('./staffService');

function findAssignedRoom(staffBoard, userId, role) {
  const pool =
    role === 'nurse'
      ? staffBoard.nurses
      : staffBoard.clinicians.filter((person) => person.role === 'doctor');
  const person = pool.find((entry) => Number(entry.id) === Number(userId));
  if (!person?.assignedRoomId) return null;

  for (const zone of staffBoard.zones || []) {
    for (const room of zone.rooms || []) {
      if (Number(room.roomId) === Number(person.assignedRoomId)) {
        return {
          zoneId: zone.id,
          zoneName: zone.name,
          zoneColor: zone.color,
          roomId: room.roomId,
          roomName: room.name,
          doctor: room.doctor,
          nurses: room.nurses || [],
          bedsTotal: room.bedsTotal,
          bedsOccupied: room.bedsOccupied,
        };
      }
    }
  }

  return {
    roomId: person.assignedRoomId,
    roomName: person.assignedRoomName,
    zoneName: person.assignedZoneName,
    doctor: null,
    nurses: [],
  };
}

async function getClinicianWorkspace(actorUser) {
  const [board, staffBoard] = await Promise.all([getBoardSnapshot(actorUser), getStaffBoard()]);
  const assignment = findAssignedRoom(staffBoard, actorUser.id, actorUser.role);
  const roomId = assignment?.roomId ?? null;

  const beds = roomId
    ? board.beds.filter((bed) => Number(bed.roomId) === Number(roomId))
    : [];

  const roomVisits = beds
    .filter((bed) => bed.occupied && bed.visitId)
    .map((bed) => ({
      visitId: bed.visitId,
      publicCode: bed.publicCode,
      priority: bed.priority,
      patientName: bed.patientName,
      status: bed.visitStatus,
      bedId: bed.bedId,
      bedLabel: bed.bedLabel,
      roomName: bed.roomName,
      zoneName: bed.zoneName,
      assignedAt: bed.assignedAt,
    }))
    .sort((a, b) => {
      const order = { in_treatment: 0, placed: 1, waiting: 2 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });

  const isNurse = actorUser.role === 'nurse';
  const isDoctor = actorUser.role === 'doctor';
  const isClinicianBoard = isNurse || isDoctor;

  const waitingQueue = isClinicianBoard ? board.waiting : [];
  const waitingToPlace = isNurse ? board.waiting.filter((row) => row.isCalled) : [];
  const allBeds = isClinicianBoard ? board.beds : [];

  const zones = isClinicianBoard
    ? [...new Map(
        allBeds.map((bed) => [
          bed.zoneId,
          { zoneId: bed.zoneId, zoneName: bed.zoneName, zoneColor: bed.zoneColor },
        ])
      ).values()].sort((a, b) => String(a.zoneName).localeCompare(String(b.zoneName)))
    : [];

  const pendingConsultation = roomVisits.filter((visit) => visit.status === 'placed');
  const activeConsultation = roomVisits.filter((visit) => visit.status === 'in_treatment');

  const stats = {
    bedsTotal: beds.length,
    bedsFree: beds.filter((bed) => !bed.occupied).length,
    patientsInRoom: roomVisits.length,
    inConsultation: activeConsultation.length,
    pendingConsultation: pendingConsultation.length,
    waitingCalled: waitingToPlace.length,
    waitingTotal: waitingQueue.length,
    waitingUncalled: waitingQueue.filter((row) => !row.isCalled).length,
    hospitalBedsFree: allBeds.filter((bed) => !bed.occupied).length,
    hospitalBedsTotal: allBeds.length,
  };

  return {
    assignment,
    beds,
    roomVisits,
    pendingConsultation,
    activeConsultation,
    waitingToPlace,
    waitingQueue,
    allBeds,
    zones,
    stats,
    capabilities: getCapabilities(actorUser.role),
    timestamp: board.timestamp,
  };
}

module.exports = {
  getClinicianWorkspace,
};
