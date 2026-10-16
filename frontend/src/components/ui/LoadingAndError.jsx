import { AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils.js'

export function LoadingSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={cn('space-y-2 animate-pulse', className)} aria-busy="true" aria-label="Chargement en cours">
      <div className="h-4 bg-slate-200/80 rounded w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-9 bg-slate-100 rounded-lg border border-slate-200/40 w-full"
        />
      ))}
    </div>
  )
}

export function ErrorState({
  title = 'Erreur lors du chargement des données',
  message = null,
  onRetry = null,
  compact = false,
  className = '',
}) {
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2 text-xs text-rose-900',
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="size-4 shrink-0 text-rose-600" aria-hidden="true" />
          <span className="font-semibold truncate">{message || title}</span>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 font-bold text-rose-700 hover:text-rose-900 shrink-0"
          >
            <RefreshCw className="size-3" />
            Réessayer
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-center text-rose-950 space-y-3',
        className
      )}
    >
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertCircle className="size-5" aria-hidden="true" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-rose-900">{title}</h4>
        {message ? <p className="mt-1 text-xs text-rose-700 max-w-md mx-auto">{message}</p> : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
        >
          <RefreshCw className="size-3.5" />
          Réessayer
        </button>
      ) : null}
    </div>
  )
}
