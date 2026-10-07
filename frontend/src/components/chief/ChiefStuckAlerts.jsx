import { AlertTriangle } from 'lucide-react'
import { formatDuration, stuckBadgeClass } from '@/components/chief/chiefUtils.js'

export function ChiefStuckAlerts({ alerts, sla, onSelectVisit }) {
  if (!alerts?.length) {
    return (
      <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-800">
          Aucun blocage SLA détecté (appel {sla?.calledWaitingMinutes} min · lit{' '}
          {sla?.placedWithoutStartMinutes} min · consult. {sla?.inTreatmentMinutes} min).
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50/80 p-4 shadow-xs">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="size-5 text-rose-600" />
        <h2 className="text-sm font-extrabold text-rose-900">
          Blocages & délais ({alerts.length})
        </h2>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {alerts.map((v) => (
          <li key={v.visitId} className="min-w-[220px] shrink-0">
            <button
              type="button"
              onClick={() => onSelectVisit(v.visitId)}
              className="w-full rounded-xl border border-rose-200/80 bg-white p-3 text-left shadow-xs hover:border-rose-400"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] font-bold text-slate-600">{v.publicCode}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase ring-1 ring-inset ${stuckBadgeClass(v.stuckLevel)}`}
                >
                  {v.stuckLevel === 'critical' ? 'Critique' : 'Alerte'}
                </span>
              </div>
              <p className="mt-1 text-sm font-extrabold text-slate-900">{v.patientName}</p>
              <p className="mt-1 text-[11px] font-bold text-rose-800">{v.stuckLabel}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                {formatDuration(v.minutesInStep)} dans l’étape
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
