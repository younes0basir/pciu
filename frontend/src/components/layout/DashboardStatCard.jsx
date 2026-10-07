export function DashboardStatCard({ icon: Icon, label, value, sub, tone, layout = 'row' }) {
  if (layout === 'column') {
    return (
      <div className="dashboard-stat-card group rounded-3xl border border-slate-200/70 bg-white/85 p-4 shadow-sm shadow-slate-300/20 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-300/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">{value}</p>
            {sub ? <p className="mt-0.5 text-xs font-semibold text-slate-500">{sub}</p> : null}
          </div>
          {Icon ? (
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-inner ${tone}`}
            >
              <Icon className="size-5" aria-hidden="true" />
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-stat-card group flex items-center gap-3 rounded-3xl border border-slate-200/70 bg-white/85 px-4 py-3.5 shadow-sm shadow-slate-300/20 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-300/30">
      {Icon ? (
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-xl font-extrabold tabular-nums tracking-tight text-slate-900">{value}</p>
        {sub ? <p className="mt-0.5 text-xs font-semibold text-slate-500">{sub}</p> : null}
      </div>
    </div>
  )
}
