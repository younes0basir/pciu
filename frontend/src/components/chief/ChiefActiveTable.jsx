import {
  formatDuration,
  PIPELINE_STAGE_LABELS,
  priorityBadgeClass,
  stuckBadgeClass,
} from '@/components/chief/chiefUtils.js'

export function ChiefActiveTable({ visits, onSelectVisit }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-extrabold text-slate-900">Tous les patients actifs</h2>
        <p className="text-xs font-semibold text-slate-500">
          Vue liste · {visits.length} visite(s) en cours
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Patient</th>
              <th className="px-4 py-2">P</th>
              <th className="px-4 py-2">Étape</th>
              <th className="px-4 py-2">Zone / lit</th>
              <th className="px-4 py-2">Délai étape</th>
              <th className="px-4 py-2">SLA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visits.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs font-semibold text-slate-400">
                  Aucun patient actif
                </td>
              </tr>
            ) : (
              visits.map((v) => (
                <tr
                  key={v.visitId}
                  className="cursor-pointer hover:bg-sky-50/60"
                  onClick={() => onSelectVisit(v.visitId)}
                >
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">
                    {v.publicCode}
                  </td>
                  <td className="px-4 py-2.5 font-extrabold text-slate-900">{v.patientName}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${priorityBadgeClass(v.priority)}`}
                    >
                      P{v.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                    {PIPELINE_STAGE_LABELS[v.pipelineStage] || v.status}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-600">
                    {v.zoneName && v.bedLabel ? `${v.zoneName} · ${v.bedLabel}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-xs font-bold text-slate-800">
                    {formatDuration(v.minutesInStep)}
                  </td>
                  <td className="px-4 py-2.5">
                    {v.stuckLabel ? (
                      <span
                        className={`inline-block max-w-[140px] truncate rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${stuckBadgeClass(v.stuckLevel)}`}
                        title={v.stuckLabel}
                      >
                        {v.stuckLabel}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">OK</span>
                    )}
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
