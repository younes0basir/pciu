import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BedDouble,
  Clock,
  HeartPulse,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react'

import { fetchPatientAnalytics } from '@/api/chief.js'
import { formatDuration } from '@/components/chief/chiefUtils.js'
import { EmptyState } from '@/components/ui/EmptyState.jsx'
import { ErrorState, LoadingSkeleton } from '@/components/ui/LoadingAndError.jsx'
import { StatCard } from '@/components/ui/StatCard.jsx'
import { cn } from '@/lib/utils.js'

const PERIODS = [
  { id: 'today', label: 'Aujourd’hui' },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
]

const PRIORITY_META = {
  1: { label: 'P1 · Critique', bar: 'bg-rose-700' },
  2: { label: 'P2 · Très urgent', bar: 'bg-orange-700' },
  3: { label: 'P3 · Urgent', bar: 'bg-amber-700' },
  4: { label: 'P4 · Moins urgent', bar: 'bg-sky-700' },
  5: { label: 'P5 · Non urgent', bar: 'bg-slate-500' },
}

const AGE_LABELS = {
  '0-17': '0 – 17 ans',
  '18-39': '18 – 39 ans',
  '40-64': '40 – 64 ans',
  '65-79': '65 – 79 ans',
  '80+': '80 ans et plus',
  unknown: 'Âge non renseigné',
}

const SEX_LABELS = {
  female: 'Femmes',
  male: 'Hommes',
  other: 'Autre',
  unknown: 'Non renseigné',
}

const OUTCOME_LABELS = {
  open: 'Encore dans le service',
  discharged: 'Sortie',
  admitted: 'Hospitalisation',
  transferred: 'Transfert',
  left_before_seen: 'Parti avant examen',
  left_during_care: 'Parti pendant les soins',
  other: 'Autre issue',
  unspecified: 'Issue non renseignée',
}

function shareOf(count, total) {
  if (!total) return 0
  return Math.round((count / total) * 100)
}

function formatPercent(value) {
  if (value == null) return '—'
  return Number.isInteger(value) ? `${value} %` : `${value.toLocaleString('fr-FR')} %`
}

function categoryLabel(kind, key) {
  if (kind === 'priority') return PRIORITY_META[key]?.label || `P${key}`
  if (kind === 'age') return AGE_LABELS[key] || key
  if (kind === 'sex') return SEX_LABELS[key] || key
  if (kind === 'outcome') return OUTCOME_LABELS[key] || key
  if (kind === 'mode') return key === 'unknown' ? 'Mode non renseigné' : key
  if (kind === 'complaint') return key.charAt(0).toUpperCase() + key.slice(1)
  return key
}

function DistributionCard({ title, description, items, total, kind, emptyLabel, scrollable = false }) {
  const max = Math.max(1, ...items.map((item) => item.count))

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-2xs">
      <h3 className="text-sm font-bold text-text-primary">{title}</h3>
      <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
      {items.length === 0 ? (
        <div className="mt-3">
          <EmptyState title={emptyLabel} description="Aucune arrivée sur cette période." />
        </div>
      ) : (
        <ul className={cn('mt-3 space-y-2.5', scrollable && 'max-h-80 overflow-y-auto pr-1')}>
          {items.map((item) => {
            const share = shareOf(item.count, total)
            const label = item.label || categoryLabel(kind, item.key)
            const width = Math.max(item.count > 0 ? 4 : 0, Math.round((item.count / max) * 100))
            return (
              <li key={item.key}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-semibold text-text-primary">{label}</span>
                  <span className="shrink-0 tabular-nums text-text-secondary">
                    {item.count}
                    <span className="text-text-secondary"> · {share} %</span>
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-100"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={max}
                  aria-valuenow={item.count}
                  aria-label={`${label} : ${item.count} arrivée${item.count > 1 ? 's' : ''}, ${share} %`}
                >
                  <div
                    className={cn(
                      'h-2 rounded-full',
                      kind === 'priority' ? PRIORITY_META[item.key]?.bar || 'bg-primary' : 'bg-sky-700'
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function ArrivalChart({ series, granularity }) {
  const max = Math.max(1, ...series.map((point) => point.count))
  const peak = series.reduce((best, point) => (point.count > (best?.count || 0) ? point : best), null)

  if (granularity === 'day') {
    return (
      <DistributionCard
        title="Arrivées par jour"
        description={peak?.count ? `Jour le plus chargé : ${peak.label} (${peak.count}).` : 'Volume quotidien des arrivées.'}
        items={series.map((point) => ({ key: point.bucket, count: point.count, label: point.label }))}
        total={series.reduce((sum, point) => sum + point.count, 0)}
        kind="series"
        emptyLabel="Aucune arrivée"
        scrollable={series.length > 10}
      />
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-2xs" aria-label="Arrivées par heure">
      <h3 className="text-sm font-bold text-text-primary">Arrivées par heure</h3>
      <p className="mt-0.5 text-xs text-text-secondary">
        {peak?.count ? `Pic à ${peak.label} (${peak.count} arrivée${peak.count > 1 ? 's' : ''}).` : 'Répartition horaire des arrivées.'}
      </p>
      <ol className="mt-4 flex h-44 items-end gap-1 overflow-x-auto pb-1">
        {series.map((point) => {
          const height = point.count === 0 ? 0 : Math.max(8, Math.round((point.count / max) * 100))
          return (
            <li key={point.bucket} className="flex h-full min-w-7 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-semibold tabular-nums text-text-secondary">
                {point.count > 0 ? point.count : ''}
              </span>
              <div className="flex h-28 w-full items-end">
                <div
                  className="w-full rounded-t bg-sky-700"
                  style={{ height: `${height}%` }}
                  role="img"
                  aria-label={`${point.label} : ${point.count} arrivée${point.count > 1 ? 's' : ''}`}
                />
              </div>
              <span className="text-xs tabular-nums text-text-secondary">{point.shortLabel}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function buildReading(data) {
  if (!data?.summary?.arrivals) return []
  const { summary } = data
  const lines = []
  const topPriority = [...data.priorities].sort((a, b) => b.count - a.count)[0]
  if (topPriority?.count) {
    lines.push(
      `Priorité la plus fréquente : ${categoryLabel('priority', topPriority.key)} (${shareOf(topPriority.count, summary.arrivals)} %).`
    )
  }
  const topAge = [...data.ageBands].sort((a, b) => b.count - a.count)[0]
  if (topAge?.count) {
    lines.push(
      `Tranche d’âge dominante : ${categoryLabel('age', topAge.key)} (${shareOf(topAge.count, summary.arrivals)} %).`
    )
  }
  if (summary.critical > 0) {
    lines.push(
      `${summary.critical} passage${summary.critical > 1 ? 's' : ''} avec alerte critique (${shareOf(summary.critical, summary.arrivals)} %).`
    )
  }
  if (summary.leftWithoutCare > 0) {
    lines.push(`Départs anticipés : ${formatPercent(summary.leftWithoutCareRate)} des arrivées.`)
  }
  return lines
}

export function PatientAnalyticsPanel({ refreshToken = null }) {
  const [period, setPeriod] = useState('today')
  const [retryTick, setRetryTick] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchPatientAnalytics(period)
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Analyse indisponible')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [period, refreshToken, retryTick])

  const reading = useMemo(() => buildReading(data), [data])
  const current = data?.period === period ? data : null
  const arrivals = current?.summary?.arrivals ?? 0
  const dominantAge = useMemo(() => {
    if (!current) return null
    return [...current.ageBands].sort((a, b) => b.count - a.count)[0] || null
  }, [current])
  const periodLabel = PERIODS.find((item) => item.id === period)?.label || 'Aujourd’hui'

  return (
    <section className="space-y-4" aria-labelledby="patient-analytics-heading">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-2xs sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="patient-analytics-heading" className="text-lg font-black text-text-primary sm:text-xl">
            Analyse des données patients
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs text-text-secondary">
            Volumes, profils et délais des arrivées — {periodLabel.toLowerCase()}. Indicateurs agrégés, sans identité patient.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Période d’analyse">
          {PERIODS.map((item) => {
            const selected = period === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setPeriod(item.id)}
                className={cn(
                  'min-h-11 rounded-xl border px-3.5 text-xs font-bold transition',
                  selected
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-text-secondary hover:bg-surface-muted'
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={() => setRetryTick((tick) => tick + 1)} /> : null}

      {loading && !current ? <LoadingSkeleton lines={6} /> : null}

      {current ? (
        <div className={cn('space-y-4', loading && 'opacity-70')} aria-busy={loading}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Arrivées"
              value={current.summary.arrivals}
              sub={periodLabel}
              tone="bg-sky-100 text-sky-800"
            />
            <StatCard
              icon={Activity}
              label="Encore ouvertes"
              value={current.summary.stillOpen}
              sub={`${current.summary.closed} clôturée(s)`}
              tone="bg-indigo-100 text-indigo-800"
            />
            <StatCard
              icon={HeartPulse}
              label="Critiques"
              value={current.summary.critical}
              sub={current.summary.arrivals ? `${shareOf(current.summary.critical, current.summary.arrivals)} % des arrivées` : 'Aucun passage'}
              tone="bg-rose-100 text-rose-800"
              accentBorder={current.summary.critical > 0 ? 'border-rose-300' : ''}
            />
            <StatCard
              icon={UserRound}
              label="Départs anticipés"
              value={current.summary.leftWithoutCare}
              sub={formatPercent(current.summary.leftWithoutCareRate)}
              tone="bg-amber-100 text-amber-800"
            />
            <StatCard
              icon={Clock}
              label="Séjour médian"
              value={formatDuration(current.summary.medianStayMinutes)}
              sub="Arrivée → clôture"
              tone="bg-violet-100 text-violet-800"
            />
            <StatCard
              icon={Stethoscope}
              label="Porte → médecin"
              value={formatDuration(current.summary.medianDoorToDoctorMinutes)}
              sub="Délai médian"
              tone="bg-teal-100 text-teal-800"
            />
            <StatCard
              icon={BedDouble}
              label="Hospitalisations"
              value={current.summary.admitted}
              sub={current.summary.closed ? `${formatPercent(current.summary.admissionRate)} des clôtures` : 'Aucune clôture'}
              tone="bg-emerald-100 text-emerald-800"
            />
            <StatCard
              icon={Users}
              label="Âge dominant"
              value={dominantAge?.count ? categoryLabel('age', dominantAge.key) : '—'}
              sub={dominantAge?.count ? `${dominantAge.count} arrivée(s)` : 'Aucun passage'}
              tone="bg-slate-100 text-slate-700"
            />
          </div>

          {arrivals > 0 && reading.length > 0 ? (
            <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-2xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Lecture rapide</h2>
              <ul className="mt-2 space-y-1 text-sm text-text-primary">
                {reading.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              compact={false}
              title="Aucune arrivée sur cette période"
              description="Les répartitions et délais s’afficheront dès le prochain enregistrement."
            />
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ArrivalChart series={current.series} granularity={current.granularity} />
            <DistributionCard
              title="Priorité clinique"
              description="Répartition des priorités enregistrées à l’arrivée."
              items={current.priorities}
              total={arrivals}
              kind="priority"
              emptyLabel="Aucune priorité"
            />
            <DistributionCard
              title="Tranches d’âge"
              description="Âge calculé à la date d’arrivée."
              items={current.ageBands}
              total={arrivals}
              kind="age"
              emptyLabel="Aucun âge"
            />
            <DistributionCard
              title="Sexe"
              description="Répartition déclarée à l’enregistrement."
              items={current.sexes}
              total={arrivals}
              kind="sex"
              emptyLabel="Sexe non renseigné"
            />
            <DistributionCard
              title="Mode d’arrivée"
              description="Comment les patients se présentent au service."
              items={current.arrivalModes}
              total={arrivals}
              kind="mode"
              emptyLabel="Mode non renseigné"
            />
            <DistributionCard
              title="Issue du passage"
              description="Parcours encore ouverts et issues des visites clôturées."
              items={current.outcomes}
              total={arrivals}
              kind="outcome"
              emptyLabel="Aucune issue"
            />
          </div>

          <DistributionCard
            title="Motifs les plus fréquents"
            description="Plaintes principales regroupées, limitées aux huit premiers motifs."
            items={current.complaints}
            total={arrivals}
            kind="complaint"
            emptyLabel="Aucun motif saisi"
          />
        </div>
      ) : null}
    </section>
  )
}
