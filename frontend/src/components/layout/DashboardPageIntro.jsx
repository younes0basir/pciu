export function DashboardPageIntro({ title, description, meta, actions, tabs }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-balance text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm font-medium leading-relaxed text-slate-600">
            {description}
          </p>
        ) : null}
        {meta ? <p className="mt-1 text-xs font-semibold text-slate-500">{meta}</p> : null}
      </div>
      {(actions || tabs) && (
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          {tabs}
        </div>
      )}
    </div>
  )
}
