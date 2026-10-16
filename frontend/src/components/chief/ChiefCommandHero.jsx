import { Activity, UserPlus } from 'lucide-react'

import { ChiefKpiBar } from '@/components/chief/ChiefKpiBar.jsx'

/**
 * Command-center hero for the chief flow workspace.
 * Fuses the page header and the KPI rail into one cohesive, low-noise surface
 * so the top of the screen reads as a single summary instead of stacked cards.
 */
export function ChiefCommandHero({
  stats,
  pipeline,
  beds,
  supervisionKpis,
  formatDuration,
  lastUpdated,
  onKpiClick,
  onRegister,
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-surface to-surface shadow-sm shadow-amber-200/30">
      <div
        className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-amber-300/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4 px-5 pb-2 pt-5">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700/90">
            Command center · Urgences CHU
          </p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-text-primary sm:text-2xl">
            Supervision active
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-secondary">
            Coordination en temps réel des parcours, du flux de lits et des alertes opérationnelles.
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-text-secondary">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2 py-0.5 text-emerald-800">
              <Activity className="size-3" aria-hidden="true" />
              Temps réel
            </span>
            {lastUpdated ? <span>Dernière synchro · {lastUpdated}</span> : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onRegister}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:brightness-105 active:scale-[0.98]"
        >
          <UserPlus className="size-4" aria-hidden />
          <span>Nouveau patient</span>
        </button>
      </div>

      <div className="relative px-5 pb-5 pt-4">
        <ChiefKpiBar
          stats={stats}
          pipeline={pipeline}
          beds={beds}
          supervisionKpis={supervisionKpis}
          formatDuration={formatDuration}
          onKpiClick={onKpiClick}
        />
      </div>
    </section>
  )
}
