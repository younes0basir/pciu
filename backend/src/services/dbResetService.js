const { withTransaction, query } = require('../config/db');
const { syncAdminFromEnv } = require('./adminBootstrap');
const {
  DEMO_STAFF_EMAILS,
  defaultDemoPasswordHash,
  seedDemoStaff,
  seedInfrastructure,
} = require('./seedDataService');

const CONFIRM_PHRASE = 'REINITIALISER';

const FULL_RESET_OPTIONS = {
  clearClinical: true,
  clearRoomTeams: true,
  clearResourceEvents: true,
  resetBedStatus: true,
  clearNonAdminStaff: true,
  reseedDemoStaff: true,
  rebuildInfrastructure: true,
  reseedInfrastructure: false,
  syncAdminFromEnv: true,
};

async function getDatabaseSnapshot() {
  const result = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM visits) AS visits,
       (SELECT COUNT(*)::int FROM patients) AS patients,
       (SELECT COUNT(*)::int FROM visit_events) AS visit_events,
       (SELECT COUNT(*)::int FROM bed_assignments) AS bed_assignments,
       (SELECT COUNT(*)::int FROM consultations) AS consultations,
       (SELECT COUNT(*)::int FROM triage_assessments) AS triage_assessments,
       (SELECT COUNT(*)::int FROM exams) AS exams,
       (SELECT COUNT(*)::int FROM care_tasks) AS care_tasks,
       (SELECT COUNT(*)::int FROM room_teams) AS room_teams,
       (SELECT COUNT(*)::int FROM resource_status_events) AS resource_status_events,
       (SELECT COUNT(*)::int FROM users) AS users,
       (SELECT COUNT(*)::int FROM users WHERE role = 'admin') AS admin_users,
       (SELECT COUNT(*)::int FROM zones) AS zones,
       (SELECT COUNT(*)::int FROM rooms) AS rooms,
       (SELECT COUNT(*)::int FROM beds) AS beds`,
  );
  return result.rows[0];
}

async function clearAgentData(client) {
  try {
    await client.query('DELETE FROM agent_approvals');
    await client.query('DELETE FROM agent_actions');
    await client.query('DELETE FROM agent_recommendations');
    await client.query('DELETE FROM agent_runs');
  } catch (error) {
    if (error.code !== '42P01') throw error;
  }
}

async function clearClinicalData(client) {
  await clearAgentData(client);
  await client.query('DELETE FROM exams');
  await client.query('DELETE FROM care_tasks');
  await client.query('DELETE FROM triage_assessments');
  await client.query('DELETE FROM consultations');
  await client.query('DELETE FROM bed_assignments');
  await client.query('DELETE FROM visit_events');
  const visits = await client.query('DELETE FROM visits');
  const patients = await client.query('DELETE FROM patients');
  return { visitsDeleted: visits.rowCount, patientsDeleted: patients.rowCount };
}

async function clearRoomTeams(client) {
  await client.query('DELETE FROM room_team_nurses');
  const teams = await client.query('DELETE FROM room_teams');
  return { roomTeamsDeleted: teams.rowCount };
}

async function clearResourceEvents(client) {
  const res = await client.query('DELETE FROM resource_status_events');
  return { resourceStatusEventsDeleted: res.rowCount };
}

async function resetAllBedStatus(client) {
  const res = await client.query(
    `UPDATE beds SET operational_status = 'ready' WHERE operational_status IS DISTINCT FROM 'ready'`,
  );
  return { bedsReset: res.rowCount };
}

async function clearInfrastructure(client) {
  await client.query('DELETE FROM resource_status_events');
  const beds = await client.query('DELETE FROM beds');
  const rooms = await client.query('DELETE FROM rooms');
  const zones = await client.query('DELETE FROM zones');
  return {
    bedsDeleted: beds.rowCount,
    roomsDeleted: rooms.rowCount,
    zonesDeleted: zones.rowCount,
  };
}

async function clearNonAdminStaff(client) {
  const res = await client.query(`DELETE FROM users WHERE role <> 'admin'`);
  return { staffDeleted: res.rowCount };
}

async function clearDemoStaffOnly(client) {
  const res = await client.query(
    `DELETE FROM users WHERE lower(email) = ANY($1::text[]) AND role <> 'admin'`,
    [DEMO_STAFF_EMAILS],
  );
  return { demoStaffDeleted: res.rowCount };
}

function normalizeOptions(mode, rawOptions = {}) {
  if (mode === 'full') {
    return { ...FULL_RESET_OPTIONS };
  }

  return {
    clearClinical: Boolean(rawOptions.clearClinical),
    clearRoomTeams: Boolean(rawOptions.clearRoomTeams),
    clearResourceEvents: Boolean(rawOptions.clearResourceEvents),
    resetBedStatus: Boolean(rawOptions.resetBedStatus),
    clearNonAdminStaff: Boolean(rawOptions.clearNonAdminStaff),
    clearDemoStaffOnly: Boolean(rawOptions.clearDemoStaffOnly),
    reseedDemoStaff: Boolean(rawOptions.reseedDemoStaff),
    rebuildInfrastructure: Boolean(rawOptions.rebuildInfrastructure),
    reseedInfrastructure: Boolean(rawOptions.reseedInfrastructure),
    syncAdminFromEnv: Boolean(rawOptions.syncAdminFromEnv),
  };
}

function validateResetRequest({ mode, confirmPhrase, options }) {
  if (confirmPhrase !== CONFIRM_PHRASE) {
    const error = new Error(`Saisissez exactement « ${CONFIRM_PHRASE} » pour confirmer.`);
    error.status = 400;
    throw error;
  }

  if (mode !== 'full' && mode !== 'custom') {
    const error = new Error('Mode invalide : utilisez full ou custom.');
    error.status = 400;
    throw error;
  }

  const normalized = normalizeOptions(mode, options);
  const hasAction =
    normalized.clearClinical ||
    normalized.clearRoomTeams ||
    normalized.clearResourceEvents ||
    normalized.resetBedStatus ||
    normalized.clearNonAdminStaff ||
    normalized.clearDemoStaffOnly ||
    normalized.reseedDemoStaff ||
    normalized.rebuildInfrastructure ||
    normalized.reseedInfrastructure ||
    normalized.syncAdminFromEnv;

  if (mode === 'custom' && !hasAction) {
    const error = new Error('Sélectionnez au moins une action pour une réinitialisation personnalisée.');
    error.status = 400;
    throw error;
  }

  if (normalized.clearNonAdminStaff && normalized.clearDemoStaffOnly) {
    const error = new Error('Choisissez soit « tout le personnel non-admin », soit « comptes démo » uniquement.');
    error.status = 400;
    throw error;
  }

  if (normalized.rebuildInfrastructure && !normalized.clearClinical) {
    const error = new Error(
      'La reconstruction des zones/lits exige aussi la suppression des données cliniques (visites).',
    );
    error.status = 400;
    throw error;
  }

  return normalized;
}

async function executeDatabaseReset({ mode, confirmPhrase, options }) {
  const normalized = validateResetRequest({ mode, confirmPhrase, options });
  const summary = {
    mode,
    steps: {},
  };

  await withTransaction(async (client) => {
    if (normalized.clearClinical) {
      summary.steps.clinical = await clearClinicalData(client);
    }

    if (normalized.clearRoomTeams) {
      summary.steps.roomTeams = await clearRoomTeams(client);
    }

    if (normalized.clearResourceEvents) {
      summary.steps.resourceEvents = await clearResourceEvents(client);
    }

    if (normalized.resetBedStatus) {
      summary.steps.bedStatus = await resetAllBedStatus(client);
    }

    if (normalized.rebuildInfrastructure) {
      await clearRoomTeams(client);
      summary.steps.infrastructure = await clearInfrastructure(client);
    }

    if (normalized.clearNonAdminStaff || normalized.clearDemoStaffOnly) {
      if (!normalized.clearRoomTeams && !summary.steps.roomTeams) {
        summary.steps.roomTeams = await clearRoomTeams(client);
      }
      if (normalized.clearNonAdminStaff) {
        summary.steps.staff = await clearNonAdminStaff(client);
      } else {
        summary.steps.staff = await clearDemoStaffOnly(client);
      }
    }

    if (normalized.reseedDemoStaff) {
      const passwordHash = await defaultDemoPasswordHash();
      const count = await seedDemoStaff(client, passwordHash);
      summary.steps.reseedDemoStaff = { accountsUpserted: count };
    }

    if (normalized.rebuildInfrastructure) {
      summary.steps.reseedInfrastructure = await seedInfrastructure(client);
    } else if (normalized.reseedInfrastructure) {
      summary.steps.reseedInfrastructure = await seedInfrastructure(client);
    }
  });

  if (normalized.syncAdminFromEnv) {
    summary.steps.adminSync = await syncAdminFromEnv();
  }

  summary.snapshot = await getDatabaseSnapshot();
  return summary;
}

module.exports = {
  CONFIRM_PHRASE,
  FULL_RESET_OPTIONS,
  getDatabaseSnapshot,
  executeDatabaseReset,
};
