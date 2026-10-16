import { Clock } from 'lucide-react'

import { cn } from '@/lib/utils.js'

export function DashboardPageHeader({
  title,
  badge = null,
  description = null,
  meta = null,
  actions = null,
  status = null,
  lastUpdated = null,
  className = '',
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-black tracking-tight text-text-primary sm:text-xl">{title}</h1>
          {badge ? (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              {badge}
            </span>
          ) : null}
          {lastUpdated ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-secondary"
              title={`Dernière synchronisation : ${lastUpdated}`}
            >
              <Clock className="size-3" aria-hidden="true" />
              {lastUpdated}
            </span>
          ) : null}
        </div>

        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
            {description}
            {meta ? <span className="text-text-secondary/80">{meta}</span> : null}
          </p>
        ) : null}

        {status ? (
          <div className="mt-1.5">{status}</div>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </header>
  )
}
