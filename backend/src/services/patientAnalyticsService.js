const { query } = require('../config/db');

const PERIODS = {
  today: { daysBack: 0, granularity: 'hour' },
  '7d': { daysBack: 6, granularity: 'day' },
  '30d': { daysBack: 29, granularity: 'day' },
};

const PRIORITY_KEYS = ['1', '2', '3', '4', '5'];
const AGE_KEYS = ['0-17', '18-39', '40-64', '65-79', '80+'];
const SEX_KEYS = ['female', 'male'];
const OUTCOME_KEYS = [
  'open',
  'discharged',
  'admitted',
  'transferred',
  'left_before_seen',
  'left_during_care',
  'other',
  'unspecified',
];

const AGE_BAND_SQL = `
  CASE
    WHEN p.birth_date IS NULL THEN 'unknown'
    WHEN date_part('year', age(v.arrived_at, p.birth_date)) < 18 THEN '0-17'
    WHEN date_part('year', age(v.arrived_at, p.birth_date)) < 40 THEN '18-39'
    WHEN date_part('year', age(v.arrived_at, p.birth_date)) < 65 THEN '40-64'
    WHEN date_part('year', age(v.arrived_at, p.birth_date)) < 80 THEN '65-79'
    ELSE '80+'
  END
`;

const SEX_SQL = `
  CASE lower(trim(COALESCE(p.sex, '')))
    WHEN 'female' THEN 'female'
    WHEN 'f' THEN 'female'
    WHEN 'femme' THEN 'female'
    WHEN 'male' THEN 'male'
    WHEN 'm' THEN 'male'
    WHEN 'homme' THEN 'male'
    WHEN '' THEN 'unknown'
    ELSE 'other'
  END
`;

const OUTCOME_SQL = `
  CASE
    WHEN v.closed_at IS NULL AND v.status IN ('waiting', 'placed', 'in_treatment') THEN 'open'
    WHEN v.outcome = 'left_during_care' THEN 'left_during_care'
    WHEN v.outcome = 'left_before_seen' OR v.status = 'left_without_seen' THEN 'left_before_seen'
    WHEN v.outcome = 'admitted' THEN 'admitted'
    WHEN v.outcome = 'transferred' OR v.status = 'transferred' THEN 'transferred'
    WHEN v.outcome = 'discharged' OR v.status = 'discharged' THEN 'discharged'
    WHEN v.outcome = 'other' THEN 'other'
    ELSE 'unspecified'
  END
`;

function normalizePeriod(value) {
  const period = String(value || 'today');
  if (!Object.prototype.hasOwnProperty.call(PERIODS, period)) {
    const error = new Error('Période invalide. Choisissez today, 7d ou 30d.');
    error.status = 400;
    throw error;
  }
  return period;
}

function asCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function asRows(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function roundMinutes(value) {
  if (value == null || value === '') return null;
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return null;
  return Math.max(0, Math.round(minutes));
}

function formatRate(count, denominator) {
  if (!denominator) return null;
  return Math.round((asCount(count) / denominator) * 1000) / 10;
}

function completeCategories(rows, keys) {
  const counts = new Map((rows || []).map((row) => [String(row.key), asCount(row.count)]));
  return keys.map((key) => ({ key, count: counts.get(key) || 0 }));
}

function orderedCounts(rows, keys, { hideZero = false, hideZeroKeys = [] } = {}) {
  const known = new Set(keys);
  const completed = completeCategories(rows, keys);
  const extras = (rows || [])
    .filter((row) => !known.has(String(row.key)))
    .map((row) => ({ key: String(row.key), count: asCount(row.count) }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'fr'));
  return [...completed, ...extras].filter((row) => {
    if (row.count > 0) return true;
    if (hideZero) return false;
    return !hideZeroKeys.includes(row.key);
  });
}

function parseIsoDate(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatIsoDate(utcMs) {
  const date = new Date(utcMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayLabel(utcMs) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(utcMs));
}

function fillSeries(points, { granularity, windowStart, windowEnd }) {
  const counts = new Map((points || []).map((point) => [String(point.bucket), asCount(point.count)]));

  if (granularity === 'hour') {
    return Array.from({ length: 24 }, (_, hour) => {
      const hourLabel = String(hour).padStart(2, '0');
      const bucket = `${windowStart}T${hourLabel}`;
      return {
        bucket,
        label: `${hourLabel} h`,
        shortLabel: hourLabel,
        count: counts.get(bucket) || 0,
      };
    });
  }

  const start = parseIsoDate(windowStart);
  const end = parseIsoDate(windowEnd);
  const series = [];
  for (let cursor = start; cursor <= end; cursor += 86_400_000) {
    const bucket = formatIsoDate(cursor);
    const label = dayLabel(cursor);
    series.push({
      bucket,
      label,
      shortLabel: label,
      count: counts.get(bucket) || 0,
    });
  }
  return series;
}

function buildAnalyticsSql(granularity) {
  const bucketSql =
    granularity === 'hour'
      ? `to_char(date_trunc('hour', arrived_at), 'YYYY-MM-DD"T"HH24')`
      : `to_char(date_trunc('day', arrived_at), 'YYYY-MM-DD')`;

  return `
    WITH cohort AS (
      SELECT
        v.priority,
        v.critical_flag,
        v.status,
        v.outcome,
        v.arrived_at,
        v.closed_at,
        NULLIF(trim(v.arrival_mode), '') AS arrival_mode,
        NULLIF(left(regexp_replace(lower(trim(v.chief_complaint)), '[[:space:]]+', ' ', 'g'), 80), '') AS motif,
        ${AGE_BAND_SQL} AS age_band,
        ${SEX_SQL} AS sex_key,
        ${OUTCOME_SQL} AS outcome_key,
        cons.first_consult
      FROM visits v
      JOIN patients p ON p.id = v.patient_id
      LEFT JOIN LATERAL (
        SELECT MIN(c.started_at) AS first_consult
        FROM consultations c
        WHERE c.visit_id = v.id
      ) cons ON TRUE
      WHERE v.arrived_at >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
        AND v.arrived_at < CURRENT_DATE + INTERVAL '1 day'
    )
    SELECT
      to_char(CURRENT_DATE - ($1::int * INTERVAL '1 day'), 'YYYY-MM-DD') AS window_start,
      to_char(CURRENT_DATE, 'YYYY-MM-DD') AS window_end,
      (SELECT COUNT(*)::int FROM cohort) AS arrivals,
      (SELECT COUNT(*)::int FROM cohort WHERE closed_at IS NULL) AS still_open,
      (SELECT COUNT(*)::int FROM cohort WHERE closed_at IS NOT NULL) AS closed,
      (SELECT COUNT(*)::int FROM cohort WHERE critical_flag IS TRUE) AS critical,
      (SELECT COUNT(*)::int FROM cohort WHERE outcome_key IN ('left_before_seen', 'left_during_care')) AS left_without_care,
      (SELECT COUNT(*)::int FROM cohort WHERE outcome_key = 'admitted') AS admitted,
      (
        SELECT percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (closed_at - arrived_at)) / 60.0
        )
        FROM cohort
        WHERE closed_at IS NOT NULL AND closed_at >= arrived_at
      ) AS median_stay_minutes,
      (
        SELECT percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (first_consult - arrived_at)) / 60.0
        )
        FROM cohort
        WHERE first_consult IS NOT NULL AND first_consult >= arrived_at
      ) AS median_door_to_doctor_minutes,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('key', priority::text, 'count', n) ORDER BY priority)
        FROM (
          SELECT priority, COUNT(*)::int AS n
          FROM cohort
          GROUP BY priority
        ) priorities
      ), '[]'::jsonb) AS priorities,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('key', age_band, 'count', n))
        FROM (
          SELECT age_band, COUNT(*)::int AS n
          FROM cohort
          GROUP BY age_band
        ) ages
      ), '[]'::jsonb) AS age_bands,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('key', sex_key, 'count', n))
        FROM (
          SELECT sex_key, COUNT(*)::int AS n
          FROM cohort
          GROUP BY sex_key
        ) sexes
      ), '[]'::jsonb) AS sexes,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('key', mode_key, 'count', n) ORDER BY n DESC, mode_key)
        FROM (
          SELECT COALESCE(arrival_mode, 'unknown') AS mode_key, COUNT(*)::int AS n
          FROM cohort
          GROUP BY mode_key
        ) modes
      ), '[]'::jsonb) AS arrival_modes,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('key', outcome_key, 'count', n))
        FROM (
          SELECT outcome_key, COUNT(*)::int AS n
          FROM cohort
          GROUP BY outcome_key
        ) outcomes
      ), '[]'::jsonb) AS outcomes,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('key', motif, 'count', n) ORDER BY n DESC, motif)
        FROM (
          SELECT motif, COUNT(*)::int AS n
          FROM cohort
          WHERE motif IS NOT NULL
          GROUP BY motif
          ORDER BY n DESC, motif
          LIMIT 8
        ) motifs
      ), '[]'::jsonb) AS complaints,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'count', n) ORDER BY bucket)
        FROM (
          SELECT ${bucketSql} AS bucket, COUNT(*)::int AS n
          FROM cohort
          GROUP BY 1
        ) series
      ), '[]'::jsonb) AS series
  `;
}

function mapSummary(row) {
  const arrivals = asCount(row.arrivals);
  const closed = asCount(row.closed);
  return {
    arrivals,
    stillOpen: asCount(row.still_open),
    closed,
    critical: asCount(row.critical),
    leftWithoutCare: asCount(row.left_without_care),
    admitted: asCount(row.admitted),
    medianStayMinutes: roundMinutes(row.median_stay_minutes),
    medianDoorToDoctorMinutes: roundMinutes(row.median_door_to_doctor_minutes),
    leftWithoutCareRate: formatRate(row.left_without_care, arrivals),
    admissionRate: formatRate(row.admitted, closed),
  };
}

async function getPatientAnalytics(periodInput) {
  const period = normalizePeriod(periodInput);
  const { daysBack, granularity } = PERIODS[period];
  const result = await query(buildAnalyticsSql(granularity), [daysBack]);
  const row = result.rows[0] || {};

  return {
    period,
    granularity,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    generatedAt: new Date().toISOString(),
    summary: mapSummary(row),
    priorities: completeCategories(asRows(row.priorities), PRIORITY_KEYS),
    ageBands: orderedCounts(asRows(row.age_bands), AGE_KEYS, { hideZeroKeys: ['unknown'] }),
    sexes: orderedCounts(asRows(row.sexes), SEX_KEYS, { hideZeroKeys: ['unknown', 'other'] }),
    arrivalModes: orderedCounts(asRows(row.arrival_modes), [], { hideZero: true }),
    outcomes: orderedCounts(asRows(row.outcomes), OUTCOME_KEYS, { hideZero: true }),
    complaints: asRows(row.complaints).map((item) => ({
      key: String(item.key),
      count: asCount(item.count),
    })),
    series: fillSeries(asRows(row.series), {
      granularity,
      windowStart: row.window_start,
      windowEnd: row.window_end,
    }),
  };
}

module.exports = {
  getPatientAnalytics,
  normalizePeriod,
  formatRate,
  fillSeries,
  completeCategories,
  orderedCounts,
};
