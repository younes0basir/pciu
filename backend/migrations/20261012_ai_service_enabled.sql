ALTER TABLE service_ai_settings
  ADD COLUMN IF NOT EXISTS service_enabled boolean NOT NULL DEFAULT false;
