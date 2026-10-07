import { Clock, ListOrdered, PhoneCall, Users, Zap } from 'lucide-react'

import { formatDuration } from '@/components/accueil/accueilUtils.js'
import { DashboardStatCard } from '@/components/layout/DashboardStatCard.jsx'

export function AccueilKpiBar({ stats }) {
  if (!stats) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <DashboardStatCard
        layout="column"
        icon={Users}
        label="En attente"
        value={stats.total ?? 0}
        sub="File active"
        tone="bg-sky-100 text-sky-700"
      />
      <DashboardStatCard
        layout="column"
        icon={ListOrdered}
        label="Non appelés"
        value={stats.uncalled ?? 0}
        tone="bg-slate-100 text-slate-700"
      />
      <DashboardStatCard
        layout="column"
        icon={PhoneCall}
        label="Appelés"
        value={stats.called ?? 0}
        sub="En salle d’attente"
        tone="bg-amber-100 text-amber-700"
      />
      <DashboardStatCard
        layout="column"
        icon={Zap}
        label="Priorité P1–P2"
        value={stats.priority12 ?? 0}
        tone="bg-rose-100 text-rose-700"
      />
      <DashboardStatCard
        layout="column"
        icon={Clock}
        label="Attente médiane"
        value={stats.medianWaitMinutes != null ? formatDuration(stats.medianWaitMinutes) : '—'}
        sub="Depuis l’arrivée"
        tone="bg-orange-100 text-orange-800"
      />
    </div>
  )
}
