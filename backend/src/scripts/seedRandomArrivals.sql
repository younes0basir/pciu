-- 10 arrivées aléatoires, toutes à la même heure (now() de la transaction).
-- Le panneau admin exécute la même opération et ne supprime que les visites
-- dont l'événement registered a metadata.source = 'seedRandomArrivals'.
-- L'ordre de la file reste priorité, puis arrived_at, puis id.
-- Relançable : les CIN et codes publics sont uniques à chaque exécution.

BEGIN;

WITH lists AS (
  SELECT
    ARRAY[
      'Amina', 'Youssef', 'Sara', 'Mehdi', 'Fatima',
      'Omar', 'Leila', 'Karim', 'Nadia', 'Hassan',
      'Imane', 'Rachid', 'Salma', 'Anas', 'Khadija'
    ] AS first_names,
    ARRAY[
      'Bennani', 'El Amrani', 'Tazi', 'Alaoui', 'Idrissi',
      'Chraibi', 'Berrada', 'Fassi', 'Squalli', 'Kettani',
      'Ouazzani', 'Benjelloun', 'Lahlou', 'Mansouri', 'Zahraoui'
    ] AS last_names,
    ARRAY[
      'Douleur thoracique',
      'Traumatisme crânien',
      'Fièvre et toux',
      'Douleur abdominale',
      'Essoufflement',
      'Plaie de la main',
      'Malaise',
      'Céphalées intenses',
      'Vomissements',
      'Douleur lombaire'
    ] AS complaints,
    ARRAY['À pied', 'Ambulance', 'Brancard', 'Autre'] AS modes,
    ARRAY['female', 'male'] AS sexes
),
src AS (
  SELECT
    g.n,
    l.first_names[1 + floor(random() * array_length(l.first_names, 1))::int] AS first_name,
    l.last_names[1 + floor(random() * array_length(l.last_names, 1))::int] AS last_name,
    'BK' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS') || lpad(g.n::text, 2, '0') AS national_id,
    '06' || lpad((floor(random() * 100000000))::bigint::text, 8, '0') AS phone,
    (CURRENT_DATE - ((18 + floor(random() * 60))::int || ' years')::interval)::date AS birth_date,
    l.sexes[1 + floor(random() * array_length(l.sexes, 1))::int] AS sex,
    (1 + floor(random() * 5))::smallint AS priority,
    l.complaints[1 + floor(random() * array_length(l.complaints, 1))::int] AS chief_complaint,
    l.modes[1 + floor(random() * array_length(l.modes, 1))::int] AS arrival_mode,
    'V-' || to_char(now(), 'YYMMDD') || '-' || lpad(g.n::text, 2, '0')
      || upper(substr(md5(random()::text || g.n::text), 1, 2)) AS public_code,
    now() AS arrived_at
  FROM generate_series(1, 10) AS g(n)
  CROSS JOIN lists AS l
),
inserted_patients AS (
  INSERT INTO patients (first_name, last_name, national_id, phone, birth_date, sex)
  SELECT first_name, last_name, national_id, phone, birth_date, sex
  FROM src
  RETURNING id, national_id
),
inserted_visits AS (
  INSERT INTO visits (
    public_code,
    patient_id,
    status,
    priority,
    chief_complaint,
    arrival_mode,
    arrived_at
  )
  SELECT
    s.public_code,
    p.id,
    'waiting',
    s.priority,
    s.chief_complaint,
    s.arrival_mode,
    s.arrived_at
  FROM src AS s
  JOIN inserted_patients AS p ON p.national_id = s.national_id
  RETURNING id, public_code, patient_id, priority, chief_complaint, arrival_mode, arrived_at
)
INSERT INTO visit_events (
  visit_id,
  actor_user_id,
  actor_type,
  event_type,
  from_status,
  to_status,
  metadata,
  created_at
)
SELECT
  v.id,
  NULL,
  'system',
  'registered',
  NULL,
  'waiting',
  jsonb_build_object(
    'priority', v.priority,
    'chiefComplaint', v.chief_complaint,
    'arrivalMode', v.arrival_mode,
    'source', 'seedRandomArrivals'
  ),
  v.arrived_at
FROM inserted_visits AS v;

COMMIT;
