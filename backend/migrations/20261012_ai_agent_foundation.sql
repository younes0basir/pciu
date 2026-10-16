-- AI agent foundation (runs, recommendations, settings)

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type text NOT NULL,
  visit_id bigint NULL REFERENCES visits(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'disabled',
  provider text NOT NULL DEFAULT 'nim',
  model_id text NULL,
  model_version text NULL,
  prompt_version text NULL,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'running',
  input_tokens int NULL,
  output_tokens int NULL,
  latency_ms int NULL,
  error_code text NULL
);

CREATE INDEX IF NOT EXISTS agent_runs_visit_id_started_at_idx
  ON agent_runs (visit_id, started_at DESC);

CREATE TABLE IF NOT EXISTS agent_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  visit_id bigint NULL REFERENCES visits(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5, 4) NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by bigint NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  human_decision text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_recommendations_status_check
    CHECK (status IN ('pending', 'accepted', 'modified', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS agent_recommendations_visit_status_idx
  ON agent_recommendations (visit_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  arguments_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL DEFAULT 'high',
  requires_approval boolean NOT NULL DEFAULT true,
  approval_status text NOT NULL DEFAULT 'pending',
  execution_status text NOT NULL DEFAULT 'pending',
  result_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  executed_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_action_id uuid NOT NULL REFERENCES agent_actions(id) ON DELETE CASCADE,
  reviewer_id bigint NULL REFERENCES users(id) ON DELETE SET NULL,
  decision text NULL,
  comment text NULL,
  requested_at timestamptz NOT NULL DEFAULT NOW(),
  decided_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS service_ai_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'disabled',
  agent_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by bigint NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT service_ai_settings_mode_check
    CHECK (mode IN ('disabled', 'collaborative', 'supervised_autonomy', 'full_control_simulation'))
);

INSERT INTO service_ai_settings (id, mode, agent_flags)
VALUES (1, 'disabled', '{"documentation": false, "triage": false, "triageShadow": false, "bedFlow": false, "capacity": false}'::jsonb)
ON CONFLICT (id) DO NOTHING;
