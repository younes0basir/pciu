import {
  formatDuration,
  priorityBadgeClass,
} from '@/components/chief/chiefUtils.js'
import { waitMinutesSince } from '@/components/accueil/accueilUtils.js'
import { dashboardPanelClass, dashboardPanelHeaderClass } from '@/components/layout/dashboardStyles.js'
import { useRoleTheme } from '@/contexts/RoleThemeContext.jsx'

function formatClock(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ called }) {
  if (called) {
    return (
      <span className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset bg-amber-100 text-amber-900 ring-amber-200">
        Appelé
      </span>
    )
  }
  return (
    <span className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset bg-slate-100 text-slate-700 ring-slate-200">
      Non appelé
    </span>
  )
}

export function AccueilQueueList({ visits, onSelectVisit }) {
  const theme = useRoleTheme()

  return (
    <section className={`overflow-hidden ${dashboardPanelClass}`}>
      <header className={dashboardPanelHeaderClass}>
        <h2 className="text-sm font-extrabold text-slate-900">Liste de la file</h2>
        <p className="text-xs font-semibold text-slate-500">
          Vue tableau · {visits.length} patient(s) en attente
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Patient</th>
              <th className="px-4 py-2">P</th>
              <th className="px-4 py-2">Motif</th>
              <th className="px-4 py-2">Arrivée</th>
              <th className="px-4 py-2">Attente</th>
              <th className="px-4 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visits.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs font-semibold text-slate-400">
                  Aucun patient dans la file d’attente
                </td>
              </tr>
            ) : (
              visits.map((visit) => (
                <tr
                  key={visit.visitId}
                  className={onSelectVisit ? 'cursor-pointer hover:bg-sky-50/60' : 'hover:bg-sky-50/60'}
                  onClick={onSelectVisit ? () => onSelectVisit(visit.visitId) : undefined}
                >
                  <td className={`px-4 py-2.5 tabular-nums text-xs font-extrabold ${theme.accentText}`}>
                    {visit.queuePosition}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">
                    {visit.publicCode}
                  </td>
                  <td className="px-4 py-2.5 font-extrabold text-slate-900">{visit.patientName}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${priorityBadgeClass(visit.priority)}`}
                    >
                      P{visit.priority}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-2.5 text-xs font-medium text-slate-600">
                    {visit.chiefComplaint || '—'}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-xs font-semibold text-slate-600">
                    {formatClock(visit.arrivedAt)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-xs font-bold text-slate-800">
                    {formatDuration(waitMinutesSince(visit.arrivedAt))}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge called={visit.isCalled} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
