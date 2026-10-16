import { cn } from '@/lib/utils.js'

export function StatCard({
  icon: Icon,
  label,
  value,
  sub = null,
  tone = 'bg-surface-muted text-text-secondary',
  accentBorder = '',
  className = '',
  onClick = null,
  layout = 'row',
}) {
  const displayValue = value == null || value === '' ? '—' : value
  const isInteractive = typeof onClick === 'function'
  const column = layout === 'column'

  const interactiveProps = isInteractive
    ? {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
          }
        },
      }
    : {}

  return (
    <div
      {...interactiveProps}
      className={cn(
        'group relative flex rounded-xl border border-border bg-surface shadow-2xs transition-all duration-150',
        column ? 'flex-col gap-1.5 p-3' : 'items-center gap-2.5 px-3 py-2.5',
        accentBorder,
        isInteractive &&
          'cursor-pointer hover:border-primary/40 hover:shadow-xs active:scale-[0.99]',
        className
      )}
    >
      {column ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-text-secondary">{label}</p>
            {Icon ? (
              <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tone)}>
                <Icon className="size-4" aria-hidden="true" />
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            <span className="text-xl font-bold tabular-nums tracking-tight text-text-primary">
              {displayValue}
            </span>
            {sub ? <p className="mt-0.5 text-xs font-medium text-text-secondary">{sub}</p> : null}
          </div>
        </>
      ) : (
        <>
          {Icon ? (
            <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tone)}>
              <Icon className="size-4" aria-hidden="true" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-text-secondary">{label}</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-lg font-bold tabular-nums tracking-tight text-text-primary">
                {displayValue}
              </span>
              {sub ? (
                <span className="truncate text-xs font-medium text-text-secondary">{sub}</span>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
