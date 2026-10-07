import { formatDuration, priorityBadgeClass } from '@/components/chief/chiefUtils.js'
import { useRoleTheme } from '@/contexts/RoleThemeContext.jsx'

export function AccueilQueueCard({ visit, onSelect }) {
  const theme = useRoleTheme()
  const complaint =
    visit.chiefComplaint?.length > 72
      ? `${visit.chiefComplaint.slice(0, 72)}…`
      : visit.chiefComplaint

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-bold text-slate-600">{visit.publicCode}</span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${priorityBadgeClass(visit.priority)}`}
        >
          P{visit.priority}
        </span>
      </div>
      <p className="mt-1 text-sm font-extrabold text-slate-900">{visit.patientName}</p>
      {complaint ? (
        <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-600">{complaint}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
        <span className={theme.accentText}>Position {visit.queuePosition}</span>
        <span>Attente : {formatDuration(visit.minutesInStep)}</span>
        {visit.callCount > 0 ? <span>{visit.callCount} appel(s)</span> : null}
      </div>
    </>
  )

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(visit.visitId)}
        className="w-full rounded-xl border border-slate-200/90 bg-white p-3 text-left shadow-xs transition hover:border-sky-200 hover:bg-sky-50/40"
      >
        {body}
      </button>
    )
  }

  return <article className="w-full rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">{body}</article>
}
