import { Activity, AlertTriangle, BedDouble, Clock, Users, Zap } from 'lucide-react'

function KpiTile({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{value}</p>
          {sub ? <p className="mt-0.5 text-xs font-semibold text-slate-500">{sub}</p> : null}
        </div>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  )
}

export function ChiefKpiBar({ stats, formatDuration }) {
  if (!stats) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiTile
        icon={Users}
        label="Visites actives"
        value={stats.active ?? 0}
        accent="bg-sky-100 text-sky-700"
      />
      <KpiTile
        icon={Zap}
        label="Priorité P1–P2"
        value={stats.priority12 ?? 0}
        accent="bg-rose-100 text-rose-700"
      />
      <KpiTile
        icon={Clock}
        label="Attente médiane"
        value={stats.medianWaitMinutes != null ? formatDuration(stats.medianWaitMinutes) : '—'}
        sub="Depuis l’arrivée"
        accent="bg-amber-100 text-amber-700"
      />
      <KpiTile
        icon={BedDouble}
        label="Lits"
        value={`${stats.bedsOccupied ?? 0}/${stats.bedsTotal ?? 0}`}
        sub={`${stats.bedsFree ?? 0} libre(s)`}
        accent="bg-emerald-100 text-emerald-700"
      />
      <KpiTile
        icon={AlertTriangle}
        label="Blocages SLA"
        value={stats.stuckCount ?? 0}
        sub="À traiter en priorité"
        accent="bg-orange-100 text-orange-800"
      />
      <KpiTile
        icon={Activity}
        label="Clôturées aujourd’hui"
        value={stats.closedToday ?? 0}
        accent="bg-violet-100 text-violet-700"
      />
    </div>
  )
}
