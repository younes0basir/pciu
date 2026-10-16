import { CheckCircle, Inbox, Search } from 'lucide-react'
import { cn } from '@/lib/utils.js'

export function EmptyState({
  title = 'Aucun élément',
  description = null,
  icon: Icon = Inbox,
  action = null,
  compact = true,
  className = '',
}) {
  if (compact) {
    return (
      <div
        className={cn(
          'flex min-h-[52px] max-h-[80px] items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-2 text-sm text-text-secondary',
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="size-4 shrink-0 text-text-secondary/70" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-xs text-text-primary truncate">{title}</p>
            {description ? (
              <p className="text-[11px] text-text-secondary truncate">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-muted/30 px-6 py-8 text-center',
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-surface shadow-2xs border border-border">
        <Icon className="size-5 text-text-secondary" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-sm font-bold text-text-primary">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function SearchEmptyState({ query, onReset }) {
  return (
    <EmptyState
      compact={true}
      icon={Search}
      title={`Aucun résultat pour « ${query} »`}
      description="Vérifiez l'orthographe ou réinitialisez les filtres."
      action={
        onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Réinitialiser
          </button>
        ) : null
      }
    />
  )
}
