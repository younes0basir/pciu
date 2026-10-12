-- V3 exams & care tasks (docs/PROCESSUS-URGENCES-V3.md §20)

CREATE TABLE IF NOT EXISTS exams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visit_id bigint NOT NULL REFERENCES visits(id) ON DELETE RESTRICT,
  label text NOT NULL,
  exam_type text NOT NULL DEFAULT 'lab',
  status text NOT NULL DEFAULT 'pending',
  result_summary text,
  requested_by bigint REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exams_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])
  )
);

CREATE INDEX IF NOT EXISTS exams_visit_id_status_idx ON exams (visit_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS care_tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visit_id bigint NOT NULL REFERENCES visits(id) ON DELETE RESTRICT,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  assigned_to bigint REFERENCES users(id) ON DELETE SET NULL,
  created_by bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT care_tasks_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'done'::text, 'cancelled'::text])
  )
);

CREATE INDEX IF NOT EXISTS care_tasks_visit_id_status_idx ON care_tasks (visit_id, status, created_at DESC);

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
    'exam_requested'::text,
    'exam_completed'::text,
    'task_created'::text,
    'task_completed'::text,
    'closed'::text,
    'capacity_high_load'::text,
    'capacity_saturated'::text
  ]));
