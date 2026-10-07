import { Activity, BedDouble, Clock, Users } from 'lucide-react'

import { DashboardStatCard } from '@/components/layout/DashboardStatCard.jsx'

export function ClinicianKpiBar({ stats, role }) {
  const isNurse = role === 'nurse'
  const isDoctor = role === 'doctor'

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardStatCard
        icon={Users}
        label="Patients en salle"
        value={stats?.patientsInRoom ?? 0}
        tone="bg-emerald-100 text-emerald-800"
      />
      <DashboardStatCard
        icon={Activity}
        label="En consultation"
        value={stats?.inConsultation ?? 0}
        tone="bg-amber-100 text-amber-900"
      />
      <DashboardStatCard
        icon={BedDouble}
        label="Lits libres"
        value={stats?.bedsFree ?? 0}
        tone="bg-sky-100 text-sky-800"
      />
      {isNurse ? (
        <DashboardStatCard
          icon={Clock}
          label="File d’attente"
          value={stats?.waitingTotal ?? 0}
          tone="bg-indigo-100 text-indigo-800"
        />
      ) : isDoctor ? (
        <DashboardStatCard
          icon={Clock}
          label="À ouvrir"
          value={stats?.pendingConsultation ?? 0}
          tone="bg-amber-100 text-amber-900"
        />
      ) : (
        <DashboardStatCard
          icon={BedDouble}
          label="Lits total"
          value={stats?.bedsTotal ?? 0}
          tone="bg-slate-100 text-slate-800"
        />
      )}
    </div>
  )
}
