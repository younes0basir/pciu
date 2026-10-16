-- PICU V4 Smart Emergency Workflow — additive foundation (Phase 1–4)

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS registration_priority smallint,
  ADD COLUMN IF NOT EXISTS clinical_priority_validated_at timestamptz;

UPDATE visits
SET registration_priority = priority
WHERE registration_priority IS NULL AND priority IS NOT NULL;

UPDATE visits v
SET clinical_priority_validated_at = sub.first_at
FROM (
  SELECT visit_id, MIN(performed_at) AS first_at
  FROM triage_assessments
  WHERE assessment_type = 'initial'
  GROUP BY visit_id
) sub
WHERE v.id = sub.visit_id
  AND v.clinical_priority_validated_at IS NULL;

-- Visits with legacy triage_validated events but no row (edge case): keep null until re-triage

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
    'bed_turnover_started'::text,
    'bed_ready_confirmed'::text,
    'disposition_decided'::text,
    'disposition_changed'::text,
    'exam_requested'::text,
    'exam_completed'::text,
    'task_created'::text,
    'task_completed'::text,
    'closed'::text,
    'capacity_high_load'::text,
    'capacity_saturated'::text,
    'transfer_requested'::text,
    'transfer_confirmed'::text,
    'transfer_cancelled'::text,
    'handoff_requested'::text,
    'handoff_accepted'::text,
    'handoff_declined'::text
  ]));

CREATE TABLE IF NOT EXISTS workflow_settings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by bigint REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO workflow_settings (key, value_json)
VALUES ('reassessment_interval_minutes', '60'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS operational_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  visit_id bigint REFERENCES visits(id) ON DELETE CASCADE,
  bed_id bigint REFERENCES beds(id) ON DELETE SET NULL,
  dedupe_key text NOT NULL,
  reason_code text,
  explanation text,
  responsible_role text,
  source text NOT NULL DEFAULT 'deterministic_rule',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_by bigint REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  resolved_by bigint REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_alerts_status_check CHECK (
    status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'resolved'::text])
  ),
  CONSTRAINT operational_alerts_severity_check CHECK (
    severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS operational_alerts_open_dedupe_idx
  ON operational_alerts (dedupe_key)
  WHERE status IN ('open', 'acknowledged');

CREATE INDEX IF NOT EXISTS operational_alerts_status_created_idx
  ON operational_alerts (status, created_at DESC);

CREATE TABLE IF NOT EXISTS transfer_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visit_id bigint NOT NULL REFERENCES visits(id) ON DELETE RESTRICT,
  from_bed_id bigint REFERENCES beds(id) ON DELETE SET NULL,
  to_bed_id bigint NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending',
  requested_by bigint REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by bigint REFERENCES users(id) ON DELETE SET NULL,
  cancelled_by bigint REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  CONSTRAINT transfer_requests_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'expired'::text])
  )
);

CREATE INDEX IF NOT EXISTS transfer_requests_visit_status_idx
  ON transfer_requests (visit_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS handoff_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visit_id bigint NOT NULL REFERENCES visits(id) ON DELETE RESTRICT,
  from_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  to_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  from_scope text,
  to_scope text,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  requested_by bigint REFERENCES users(id) ON DELETE SET NULL,
  responded_by bigint REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT handoff_requests_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])
  )
);

CREATE INDEX IF NOT EXISTS handoff_requests_visit_status_idx
  ON handoff_requests (visit_id, status, requested_at DESC);

DROP VIEW IF EXISTS waiting_board;
CREATE VIEW waiting_board AS
SELECT
  v.id AS visit_id,
  v.public_code,
  v.priority,
  v.registration_priority,
  v.clinical_priority_validated_at,
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
  v.registration_priority,
  v.clinical_priority_validated_at,
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
