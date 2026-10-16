import { Handshake, Truck } from 'lucide-react'

import { EmptyState } from '@/components/ui/EmptyState.jsx'
import { dashboardPanelClass } from '@/components/layout/dashboardStyles.js'

function formatWhen(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function TeamCoordinationPanel({ coordination, onSelectVisit, onOpenTeams }) {
  const handoffs = coordination?.pendingHandoffs ?? []
  const transfers = coordination?.pendingTransfers ?? []
  const total = handoffs.length + transfers.length

  return (
    <section
      className={dashboardPanelClass}
      aria-label="Coordination équipes et passations"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100/90 px-5 py-4">
        <div className="flex items-center gap-2">
          <Handshake className="size-4 text-sky-600" aria-hidden />
          <h2 className="text-sm font-bold text-text-primary">Coordination</h2>
        </div>
        {onOpenTeams ? (
          <button
            type="button"
            onClick={onOpenTeams}
            className="text-xs font-bold text-primary hover:underline"
          >
            Équipes & salles
          </button>
        ) : null}
      </div>

      <div className="max-h-[420px] space-y-3 overflow-y-auto p-4 text-xs">
        {total === 0 ? (
          <EmptyState compact title="Aucune passation en attente" description="Handoffs et transferts à jour." />
        ) : null}

        {handoffs.map((item) => (
          <button
            key={`ho-${item.id}`}
            type="button"
            onClick={() => onSelectVisit?.(item.visitId)}
            className="w-full text-left rounded-xl border border-border px-3 py-2 hover:bg-muted/40"
          >
            <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
              <Handshake className="size-3.5" aria-hidden />
              Passation en attente · {item.publicCode}
            </span>
            <p className="text-xs text-text-secondary mt-0.5">
              Demandée à {formatWhen(item.requestedAt)}
              {item.reason ? ` — ${item.reason}` : ''}
            </p>
          </button>
        ))}

        {transfers.map((item) => (
          <button
            key={`tr-${item.id}`}
            type="button"
            onClick={() => onSelectVisit?.(item.visitId)}
            className="w-full text-left rounded-xl border border-border px-3 py-2 hover:bg-muted/40"
          >
            <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
              <Truck className="size-3.5" aria-hidden />
              Transfert lit · {item.publicCode}
            </span>
            <p className="text-xs text-text-secondary mt-0.5">
              Demandé à {formatWhen(item.requestedAt)}
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}
