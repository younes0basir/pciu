-- Chef assigns one responsible clinician per room, with the nurses linked to that room.
CREATE TABLE IF NOT EXISTS room_teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id bigint NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  doctor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_teams_room_unique UNIQUE (room_id),
  CONSTRAINT room_teams_doctor_unique UNIQUE (doctor_id)
);

CREATE TABLE IF NOT EXISTS room_team_nurses (
  room_team_id bigint NOT NULL REFERENCES room_teams(id) ON DELETE CASCADE,
  nurse_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (room_team_id, nurse_id),
  CONSTRAINT room_team_nurses_nurse_unique UNIQUE (nurse_id)
);

-- Who actually wrote the note when the chef fills a consultation for another doctor.
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS recorded_by bigint REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE visit_events DROP CONSTRAINT IF EXISTS visit_events_event_type_check;
ALTER TABLE visit_events ADD CONSTRAINT visit_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'registered'::text,
    'called'::text,
    'placed'::text,
    'returned'::text,
    'consultation_started'::text,
    'consultation_updated'::text,
    'consultation_ended'::text,
    'closed'::text
  ]));
