import { getRoleDashboardTheme } from '@/theme/roleTheme.js'

export function DashboardTabBar({ role, tabs, activeId, onChange, ariaLabel = 'Navigation' }) {
  const theme = getRoleDashboardTheme(role)

  return (
    <div
      className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm shadow-slate-200/40 backdrop-blur-md"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = activeId === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-extrabold transition sm:px-4 ${
              active
                ? `${theme.tabActive} shadow-sm`
                : 'text-slate-600 hover:bg-slate-50/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/15'
            }`}
          >
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
            <span className="truncate">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
