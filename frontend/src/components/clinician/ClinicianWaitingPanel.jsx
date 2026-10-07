import { priorityBadgeClass } from '@/components/chief/chiefUtils.js'

export function ClinicianWaitingPanel({ waiting, onSelectVisit }) {
  return (
    <section className="rounded-2xl border border-indigo-100 bg-white shadow-xs overflow-hidden">
      <header className="border-b border-indigo-50 bg-indigo-50/50 px-4 py-3">
        <h2 className="text-sm font-extrabold text-indigo-950">Patients appelés — à mettre au lit</h2>
        <p className="text-xs font-semibold text-indigo-800/80">
          Placez-les dans un lit libre de votre salle ou d’une autre zone selon disponibilité.
        </p>
      </header>
      <ul className="divide-y divide-slate-100">
        {waiting.length === 0 ? (
          <li className="px-4 py-8 text-center text-xs font-semibold text-slate-400">
            Personne en attente de placement.
          </li>
        ) : (
          waiting.map((row) => (
            <li key={row.visitId}>
              <button
                type="button"
                onClick={() => onSelectVisit(row.visitId)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-indigo-50/60"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-500">{row.publicCode}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${priorityBadgeClass(row.priority)}`}
                    >
                      P{row.priority}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-extrabold text-slate-900">{row.patientName}</p>
                  <p className="line-clamp-1 text-xs font-medium text-slate-600">{row.chiefComplaint}</p>
                </div>
                <span className="shrink-0 text-xs font-extrabold text-indigo-700">Placer →</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
