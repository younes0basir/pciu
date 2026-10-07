import { Stethoscope } from 'lucide-react'

import { priorityBadgeClass, statusLabel } from '@/components/chief/chiefUtils.js'

export function DoctorCaseloadPanel({ pending, active, onSelectVisit }) {
  const hasWork = (pending?.length ?? 0) + (active?.length ?? 0) > 0

  if (!hasWork) {
    return (
      <section className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 px-4 py-6 text-center">
        <p className="text-sm font-extrabold text-emerald-900">Aucun patient à voir dans votre salle</p>
        <p className="mt-1 text-xs font-semibold text-emerald-800/80">
          Les nouveaux cas apparaîtront ici dès qu’un lit est occupé dans votre salle.
        </p>
      </section>
    )
  }

  function VisitRow({ visit, tone }) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onSelectVisit(visit.visitId)}
          className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition hover:ring-2 hover:ring-emerald-300 ${tone}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-bold text-slate-500">{visit.publicCode}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${priorityBadgeClass(visit.priority)}`}
              >
                P{visit.priority}
              </span>
              <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                {statusLabel(visit.status)}
              </span>
            </div>
            <p className="mt-1 text-sm font-extrabold text-slate-900">{visit.patientName}</p>
            <p className="text-xs font-semibold text-emerald-900">
              Lit {visit.bedLabel}
              {visit.status === 'placed' ? ' · consultation à ouvrir' : ' · en cours'}
            </p>
          </div>
          <span className="text-xs font-extrabold text-emerald-800">Voir →</span>
        </button>
      </li>
    )
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white shadow-xs overflow-hidden">
      <header className="flex items-start gap-3 border-b border-emerald-100 px-4 py-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
          <Stethoscope className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">Ma prise en charge</h2>
          <p className="text-xs font-semibold text-slate-600">
            {pending?.length ?? 0} à ouvrir · {active?.length ?? 0} en consultation
          </p>
        </div>
      </header>
      <div className="space-y-4 p-4">
        {pending?.length ? (
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-amber-800">
              Consultation à démarrer
            </h3>
            <ul className="mt-2 space-y-2">
              {pending.map((visit) => (
                <VisitRow
                  key={visit.visitId}
                  visit={visit}
                  tone="border-amber-200/80 bg-amber-50/60"
                />
              ))}
            </ul>
          </div>
        ) : null}
        {active?.length ? (
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">
              En consultation
            </h3>
            <ul className="mt-2 space-y-2">
              {active.map((visit) => (
                <VisitRow
                  key={visit.visitId}
                  visit={visit}
                  tone="border-emerald-200/80 bg-white"
                />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
