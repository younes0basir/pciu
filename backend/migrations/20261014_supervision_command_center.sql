-- Smart Supervision V4 — additive enhancements (alert audit, obsolete lifecycle)

ALTER TABLE operational_alerts DROP CONSTRAINT IF EXISTS operational_alerts_status_check;
ALTER TABLE operational_alerts ADD CONSTRAINT operational_alerts_status_check CHECK (
  status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'resolved'::text, 'obsolete'::text])
);

CREATE TABLE IF NOT EXISTS operational_alert_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id bigint NOT NULL REFERENCES operational_alerts(id) ON DELETE CASCADE,
  actor_id bigint REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operational_alert_events_alert_created_idx
  ON operational_alert_events (alert_id, created_at DESC);

INSERT INTO workflow_settings (key, value_json)
VALUES (
  'supervision_rules_v1',
  '{
    "rulesVersion": "v4-supervision-draft",
    "reassessment": { "enabled": true, "source": "reassessment_interval_minutes" },
    "triage_pending_delay": { "enabled": false, "minutes": null, "approved": false },
    "care_wait_delay": { "enabled": false, "minutes": null, "approved": false },
    "exam_pending_delay": { "enabled": false, "minutes": null, "approved": false },
    "disposition_delay": { "enabled": false, "minutes": null, "approved": false },
    "bed_turnover_delay": { "enabled": false, "minutes": null, "approved": false },
    "capacity_pressure": { "enabled": true, "approved": false, "note": "Heuristique capacité — validation CHU requise avant pilotage SLA" }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
