import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

import { EmptyState } from '@/components/ui/EmptyState.jsx'
import { dashboardPanelClass } from '@/components/layout/dashboardStyles.js'
import { cn } from '@/lib/utils.js'

const SEVERITY_LABEL = {
  critical: 'Critique',
  high: 'Élevée',
  medium: 'Modérée',
  low: 'Faible',
}

const STATUS_OPTIONS = [
  { id: 'active', label: 'Actives' },
  { id: 'open', label: 'Nouvelles' },
  { id: 'acknowledged', label: 'Prises en charge' },
  { id: 'all', label: 'Toutes' },
]

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function OperationalAlertCenter({
  alerts = [],
  loading = false,
  filter = 'active',
  onFilterChange,
  onAcknowledge,
  onSelectVisit,
  ackBusyId = null,
}) {
  return (
    <section
      className={cn('overflow-hidden', dashboardPanelClass)}
      aria-label="Centre d'alertes opérationnelles"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100/90 px-5 py-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-orange-600" aria-hidden />
          <h2 className="text-sm font-bold text-text-primary">Alertes opérationnelles</h2>
          {alerts.length > 0 ? (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black tabular-nums text-orange-900">
              {alerts.length}
            </span>
          ) : null}
        </div>

        {onFilterChange ? (
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filtrer les alertes par statut"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="max-h-[440px] space-y-2 overflow-y-auto p-4">
        {loading && alerts.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Chargement des alertes…
          </div>
        ) : null}

        {!loading && alerts.length === 0 ? (
          <EmptyState
            compact
            title="Aucune alerte active"
            description="Les conditions surveillées sont stables ou non configurées."
          />
        ) : null}

        {alerts.map((alert) => {
          const canAck = alert.status === 'open'
          const isCritical = alert.severity === 'critical'
          return (
            <article
              key={alert.id}
              className={cn(
                'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs',
                isCritical ? 'border-rose-200 bg-rose-50/70' : 'border-border bg-background/60'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 size-2 shrink-0 rounded-full',
                  isCritical ? 'bg-rose-500' : 'bg-amber-400'
                )}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <p className="font-bold text-text-primary">{alert.explanation || alert.alertType}</p>
                <p className="mt-0.5 text-[11px] text-text-secondary">
                  {SEVERITY_LABEL[alert.severity] || alert.severity} · {formatTime(alert.createdAt)}
                  {alert.publicCode ? (
                    <>
                      {' · '}
                      <button
                        type="button"
                        className="font-mono font-bold text-primary underline-offset-2 hover:underline"
                        onClick={() => alert.visitId && onSelectVisit?.(alert.visitId)}
                      >
                        {alert.publicCode}
                      </button>
                    </>
                  ) : null}
                </p>
              </div>

              {canAck ? (
                <button
                  type="button"
                  disabled={ackBusyId === alert.id}
                  onClick={() => onAcknowledge?.(alert.id)}
                  title="Accuser réception"
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-bold text-text-primary transition hover:bg-surface-muted disabled:opacity-50"
                >
                  {ackBusyId === alert.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3" />
                  )}
                  <span className="hidden sm:inline">Traiter</span>
                </button>
              ) : (
                <span className="shrink-0 text-[10px] font-semibold uppercase text-text-secondary">
                  {alert.status === 'acknowledged' ? 'Prise en charge' : alert.status}
                </span>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
