import { Download } from 'lucide-react'
import {
  exportClosedTodayCsv,
  formatDuration,
  OUTCOME_LABELS,
  priorityBadgeClass,
} from '@/components/chief/chiefUtils.js'

export function ChiefClosedTodayTable({ visits, onSelectVisit }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">Clôturées aujourd’hui</h2>
          <p className="text-xs font-semibold text-slate-500">
            Durées porte → médecin · porte → sortie
          </p>
        </div>
        <button
          type="button"
          disabled={!visits?.length}
          onClick={() => exportClosedTodayCsv(visits)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
        >
          <Download className="size-3.5" />
          Export CSV
        </button>
      </header>
      <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Patient</th>
              <th className="px-4 py-2">Issue</th>
              <th className="px-4 py-2">Porte → médecin</th>
              <th className="px-4 py-2">Porte → sortie</th>
              <th className="px-4 py-2">Clôture</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visits.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs font-semibold text-slate-400">
                  Aucune clôture aujourd’hui
                </td>
              </tr>
            ) : (
              visits.map((v) => (
                <tr
                  key={v.visitId}
                  className="cursor-pointer hover:bg-violet-50/50"
                  onClick={() => onSelectVisit(v.visitId)}
                >
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">
                    {v.publicCode}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-extrabold text-slate-900">{v.patientName}</span>
                    <span
                      className={`ml-2 rounded-md px-1 py-px text-[9px] font-extrabold ring-1 ring-inset ${priorityBadgeClass(v.priority)}`}
                    >
                      P{v.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-bold text-violet-800">
                    {OUTCOME_LABELS[v.outcome] || OUTCOME_LABELS[v.status] || v.status}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-xs font-semibold text-slate-700">
                    {formatDuration(v.minutesDoorToDoctor)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-xs font-semibold text-slate-700">
                    {formatDuration(v.minutesDoorToDischarge)}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-500">
                    {v.closedAt ? new Date(v.closedAt).toLocaleTimeString('fr-FR') : '—'}
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
