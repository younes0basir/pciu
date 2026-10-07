import { ChiefVisitCard } from '@/components/chief/ChiefVisitCard.jsx'

export function ChiefPipelineColumn({ title, subtitle, visits, tone, onSelectVisit }) {
  const toneClasses = {
    slate: 'border-slate-200 bg-slate-50/80',
    amber: 'border-amber-200 bg-amber-50/50',
    sky: 'border-sky-200 bg-sky-50/50',
    emerald: 'border-emerald-200 bg-emerald-50/50',
    violet: 'border-violet-200 bg-violet-50/50',
  }

  return (
    <section className={`flex min-h-[280px] flex-col rounded-2xl border p-3 ${toneClasses[tone] || toneClasses.slate}`}>
      <header className="mb-3 border-b border-black/5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold tabular-nums text-slate-700 ring-1 ring-slate-200">
            {visits.length}
          </span>
        </div>
        {subtitle ? <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{subtitle}</p> : null}
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto max-h-[420px] pr-0.5">
        {visits.length === 0 ? (
          <p className="py-8 text-center text-xs font-semibold text-slate-400">Aucun patient</p>
        ) : (
          visits.map((v) => <ChiefVisitCard key={v.visitId} visit={v} onSelect={onSelectVisit} />)
        )}
      </div>
    </section>
  )
}
