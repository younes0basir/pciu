-- Phase A (non-AI): agent-ready audit trail + idempotent visit actions

ALTER TABLE visit_events
  ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS agent_run_id uuid NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key text NULL;

ALTER TABLE visit_events DROP CONSTRAINT IF EXISTS visit_events_actor_type_check;
ALTER TABLE visit_events ADD CONSTRAINT visit_events_actor_type_check
  CHECK (actor_type = ANY (ARRAY['user'::text, 'agent'::text, 'system'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS visit_events_idempotency_key_unique
  ON visit_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE visit_events DROP CONSTRAINT IF EXISTS visit_events_event_type_check;
ALTER TABLE visit_events ADD CONSTRAINT visit_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'registered'::text,
    'called'::text,
    'placed'::text,
    'returned'::text,
    'triage_validated'::text,
    'consultation_started'::text,
    'consultation_updated'::text,
    'consultation_ended'::text,
    'closed'::text
  ]));

CREATE INDEX IF NOT EXISTS visit_events_created_at_id_idx
  ON visit_events (created_at DESC, id DESC);
