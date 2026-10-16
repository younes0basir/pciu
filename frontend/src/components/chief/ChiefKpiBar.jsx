import { AlertTriangle, BedDouble, Clock, FileQuestion, Users, Zap } from 'lucide-react'

import { cn } from '@/lib/utils.js'

function Segment({ icon: Icon, label, value, sub, tone, emphasis = false, interactive = false, onClick }) {
  const displayValue = value == null || value === '' ? '—' : value

  const className = cn(
    'group flex items-center gap-3 bg-surface/90 px-4 py-3.5 text-left transition-colors',
    interactive
      ? 'cursor-pointer hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40'
      : 'cursor-default'
  )

  const inner = (
    <>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-text-secondary">
          {label}
        </span>
        <span className="mt-0.5 flex items-baseline gap-1.5">
          <span
            className={cn(
              'text-xl font-black tabular-nums leading-none tracking-tight',
              emphasis ? 'text-amber-600' : 'text-text-primary'
            )}
          >
            {displayValue}
          </span>
          {sub ? (
            <span className="truncate text-[11px] font-medium text-text-secondary">{sub}</span>
          ) : null}
        </span>
      </span>
    </>
  )

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    )
  }

  return <div className={className}>{inner}</div>
}

/**
 * KPI rail for the chief command center.
 * Hairline-divided segments inside a single surface — no floating cards.
 */
export function ChiefKpiBar({
  stats,
  pipeline,
  beds,
  supervisionKpis = null,
  formatDuration,
  onKpiClick,
}) {
  if (!stats) return null

  let readyFreeBeds = stats.bedsFree ?? 0
  if (Array.isArray(beds)) {
    readyFreeBeds = beds.filter(
      (b) =>
        !b.occupied &&
        (!b.operationalStatus || b.operationalStatus === 'ready' || b.operationalStatus === 'available')
    ).length
  }

  const waitingToTriage = pipeline?.waitingUncalled?.length ?? null
  const alertCount = supervisionKpis?.openAlerts ?? stats.stuckCount ?? 0
  const neutralTone = 'bg-slate-100 text-slate-600'

  return (
    <div
      role="region"
      aria-label="Indicateurs clés du service"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/60 sm:grid-cols-3 xl:grid-cols-6"
    >
      <Segment
        icon={Users}
        label="Visites actives"
        value={stats.active}
        sub="en cours"
        tone={neutralTone}
        interactive
        onClick={() => onKpiClick?.('active')}
      />

      <Segment
        icon={Zap}
        label="Urgents P1/P2"
        value={stats.priority12}
        sub="vitaux"
        tone={stats.priority12 > 0 ? 'bg-rose-100 text-rose-700' : neutralTone}
        emphasis={stats.priority12 > 0}
        interactive
        onClick={() => onKpiClick?.('priority')}
      />

      <Segment
        icon={FileQuestion}
        label="À trier"
        value={waitingToTriage}
        sub="sans appel"
        tone={neutralTone}
        interactive
        onClick={() => onKpiClick?.('triage')}
      />

      <Segment
        icon={Clock}
        label="Attente médiane"
        value={stats.medianWaitMinutes != null ? formatDuration(stats.medianWaitMinutes) : '—'}
        sub="arrivée"
        tone={neutralTone}
      />

      <Segment
        icon={BedDouble}
        label="Lits prêts"
        value={`${readyFreeBeds}/${stats.bedsTotal ?? 0}`}
        sub={`${stats.bedsOccupied ?? 0} occupés`}
        tone={neutralTone}
        interactive
        onClick={() => onKpiClick?.('beds')}
      />

      <Segment
        icon={AlertTriangle}
        label={supervisionKpis ? 'Alertes' : 'Blocages SLA'}
        value={alertCount}
        sub={supervisionKpis ? `${supervisionKpis.acknowledgedAlerts ?? 0} traitées` : 'dépassements'}
        tone={alertCount > 0 ? 'bg-amber-100 text-amber-700' : neutralTone}
        emphasis={alertCount > 0}
        interactive
        onClick={() => onKpiClick?.('alerts')}
      />
    </div>
  )
}
