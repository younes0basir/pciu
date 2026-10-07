import { formatDuration, priorityBadgeClass, stuckBadgeClass } from '@/components/chief/chiefUtils.js'

export function ChiefVisitCard({ visit, onSelect }) {
  const complaint =
    visit.chiefComplaint?.length > 72
      ? `${visit.chiefComplaint.slice(0, 72)}…`
      : visit.chiefComplaint

  return (
    <button
      type="button"
      onClick={() => onSelect(visit.visitId)}
      className={`w-full rounded-xl border p-3 text-left shadow-xs transition hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
        visit.stuckLevel === 'critical'
          ? 'border-rose-300 bg-rose-50/40 hover:border-rose-400'
          : visit.stuckLevel === 'warning'
            ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400'
            : 'border-slate-200/90 bg-white hover:border-sky-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-bold text-slate-600">{visit.publicCode}</span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${priorityBadgeClass(visit.priority)}`}
        >
          P{visit.priority}
        </span>
      </div>
      <p className="mt-1 text-sm font-extrabold text-slate-900">{visit.patientName}</p>
      {visit.stuckLabel ? (
        <p
          className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${stuckBadgeClass(visit.stuckLevel)}`}
        >
          {visit.stuckLabel}
        </p>
      ) : null}
      {complaint ? (
        <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-600">{complaint}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
        <span>Dans l’étape : {formatDuration(visit.minutesInStep)}</span>
        {visit.zoneName && visit.bedLabel ? (
          <span className="text-sky-700">
            {visit.zoneName} · {visit.bedLabel}
          </span>
        ) : null}
        {visit.callCount > 0 ? <span>{visit.callCount} appel(s)</span> : null}
      </div>
    </button>
  )
}
