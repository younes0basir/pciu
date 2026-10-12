-- V3 Smart Emergency Flow (docs/PROCESSUS-URGENCES-V3.md) — phases 1–3 foundation

-- --- Visits: multi-dimensional workflow ---
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS care_stage text,
  ADD COLUMN IF NOT EXISTS current_orientation text,
  ADD COLUMN IF NOT EXISTS critical_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS patient_location text,
  ADD COLUMN IF NOT EXISTS care_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS disposition_decided_at timestamptz;

ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_care_stage_check;
ALTER TABLE visits ADD CONSTRAINT visits_care_stage_check
  CHECK (care_stage IS NULL OR care_stage = ANY (ARRAY[
    'registered'::text,
    'triage_pending'::text,
    'waiting_care'::text,
    'in_care'::text,
    'in_observation'::text,
    'disposition_pending'::text,
    'completed'::text
  ]));

ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_current_orientation_check;
ALTER TABLE visits ADD CONSTRAINT visits_current_orientation_check
  CHECK (current_orientation IS NULL OR current_orientation = ANY (ARRAY[
    'critical'::text, 'acute'::text, 'standard'::text, 'ambulatory'::text,
    'observation'::text, 'isolation'::text
  ]));

ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_outcome_check;
ALTER TABLE visits ADD CONSTRAINT visits_outcome_check
  CHECK (outcome IS NULL OR outcome = ANY (ARRAY[
    'discharged'::text, 'admitted'::text, 'transferred'::text,
    'left_before_seen'::text, 'left_during_care'::text, 'other'::text
  ]));

ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_patient_location_check;
ALTER TABLE visits ADD CONSTRAINT visits_patient_location_check
  CHECK (patient_location IS NULL OR patient_location = ANY (ARRAY[
    'waiting_area'::text, 'triage'::text, 'room'::text, 'resource'::text,
    'diagnostic_area'::text, 'observation'::text, 'external_transfer'::text, 'discharged'::text
  ]));

-- Backfill care_stage from legacy status
UPDATE visits
SET care_stage = CASE
  WHEN status = 'waiting' THEN 'triage_pending'
  WHEN status = 'placed' THEN 'waiting_care'
  WHEN status = 'in_treatment' THEN 'in_care'
  WHEN status IN ('discharged', 'transferred', 'left_without_seen') THEN 'completed'
  ELSE 'triage_pending'
END
WHERE care_stage IS NULL;

UPDATE visits SET care_stage = 'triage_pending' WHERE care_stage IS NULL;

ALTER TABLE visits ALTER COLUMN care_stage SET DEFAULT 'triage_pending';
ALTER TABLE visits ALTER COLUMN care_stage SET NOT NULL;

-- --- Beds as typed resources + operational status ---
ALTER TABLE beds
  ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'bed',
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'ready';

ALTER TABLE beds DROP CONSTRAINT IF EXISTS beds_resource_type_check;
ALTER TABLE beds ADD CONSTRAINT beds_resource_type_check
  CHECK (resource_type = ANY (ARRAY[
    'bed'::text, 'chair'::text, 'box'::text, 'triage_station'::text,
    'consultation_station'::text, 'other'::text
  ]));

ALTER TABLE beds DROP CONSTRAINT IF EXISTS beds_operational_status_check;
ALTER TABLE beds ADD CONSTRAINT beds_operational_status_check
  CHECK (operational_status = ANY (ARRAY[
    'ready'::text, 'cleaning'::text, 'maintenance'::text, 'blocked'::text, 'out_of_service'::text
  ]));

UPDATE beds SET resource_type = 'chair' WHERE label ILIKE '%fauteuil%';
UPDATE beds SET resource_type = 'box' WHERE label ILIKE '%box%';

ALTER TABLE bed_assignments
  ADD COLUMN IF NOT EXISTS assignment_reason text;

-- --- Triage history ---
CREATE TABLE IF NOT EXISTS triage_assessments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visit_id bigint NOT NULL REFERENCES visits(id) ON DELETE RESTRICT,
  priority smallint NOT NULL CHECK (priority BETWEEN 1 AND 5),
  assessment_type text NOT NULL CHECK (assessment_type = ANY (ARRAY[
    'initial'::text, 'reassessment'::text, 'escalation'::text
  ])),
  clinical_note text,
  vitals jsonb,
  orientation text,
  reason_for_change text,
  performed_by bigint REFERENCES users(id) ON DELETE SET NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS triage_assessments_visit_id_performed_at_idx
  ON triage_assessments (visit_id, performed_at DESC);

-- --- Resource (bed) operational status audit ---
CREATE TABLE IF NOT EXISTS resource_status_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bed_id bigint NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL,
  actor_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resource_status_events_bed_id_created_at_idx
  ON resource_status_events (bed_id, created_at DESC);

-- --- Visit events: V3 event types ---
ALTER TABLE visit_events DROP CONSTRAINT IF EXISTS visit_events_event_type_check;
ALTER TABLE visit_events ADD CONSTRAINT visit_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'registered'::text,
    'called'::text,
    'placed'::text,
    'returned'::text,
    'triage_validated'::text,
    'triage_completed'::text,
    'triage_reassessed'::text,
    'priority_changed'::text,
    'orientation_changed'::text,
    'critical_flag_set'::text,
    'consultation_started'::text,
    'consultation_updated'::text,
    'consultation_ended'::text,
    'care_started'::text,
    'observation_started'::text,
    'observation_ended'::text,
    'resource_assigned'::text,
    'resource_transferred'::text,
    'resource_released'::text,
    'disposition_decided'::text,
    'disposition_changed'::text,
    'closed'::text,
    'capacity_high_load'::text,
    'capacity_saturated'::text
  ]));

-- --- Board views (V3-aware) ---
DROP VIEW IF EXISTS waiting_board;
CREATE VIEW waiting_board AS
SELECT
  v.id AS visit_id,
  v.public_code,
  v.priority,
  v.care_stage,
  v.critical_flag,
  v.current_orientation,
  ROW_NUMBER() OVER (
    ORDER BY v.priority ASC, v.critical_flag DESC, v.arrived_at ASC, v.id ASC
  ) AS queue_position,
  v.chief_complaint,
  v.arrived_at,
  v.last_called_at,
  v.call_count,
  p.id AS patient_id,
  p.first_name,
  p.last_name,
  p.national_id
FROM visits v
JOIN patients p ON p.id = v.patient_id
WHERE v.status = 'waiting'
  AND v.closed_at IS NULL
  AND v.care_stage IN ('triage_pending', 'waiting_care', 'registered');

DROP VIEW IF EXISTS bed_board;
CREATE VIEW bed_board AS
SELECT
  z.id AS zone_id,
  z.name AS zone_name,
  z.color AS zone_color,
  r.id AS room_id,
  r.name AS room_name,
  b.id AS bed_id,
  b.label AS bed_label,
  b.resource_type,
  b.operational_status,
  (ba.id IS NOT NULL) AS occupied,
  v.id AS visit_id,
  v.public_code,
  v.status AS visit_status,
  v.care_stage,
  v.critical_flag,
  v.priority,
  p.first_name,
  p.last_name,
  ba.assigned_at
FROM zones z
JOIN rooms r ON r.zone_id = z.id AND r.is_active = true
JOIN beds b ON b.room_id = r.id AND b.is_active = true
LEFT JOIN bed_assignments ba ON ba.bed_id = b.id AND ba.released_at IS NULL
LEFT JOIN visits v ON v.id = ba.visit_id
LEFT JOIN patients p ON p.id = v.patient_id
WHERE z.is_active = true;
