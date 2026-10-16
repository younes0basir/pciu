import { GitBranch } from 'lucide-react'

import { EmptyState } from '@/components/ui/EmptyState.jsx'
import { dashboardPanelClass } from '@/components/layout/dashboardStyles.js'

export function BottleneckPanel({ signals = [] }) {
  const actionable = signals.filter((s) => s.type !== 'no_major_bottleneck')

  return (
    <section
      className={dashboardPanelClass}
      aria-label="Analyse des goulots"
    >
      <div className="flex items-center gap-2 border-b border-slate-100/90 px-5 py-4">
        <GitBranch className="size-4 text-indigo-600" aria-hidden />
        <h2 className="text-sm font-bold text-text-primary">Goulots & flux</h2>
        <span className="text-xs text-text-secondary ml-auto">Fenêtre instantanée</span>
      </div>
      <div className="max-h-[420px] space-y-2 overflow-y-auto p-4">
        {actionable.length === 0 ? (
          <EmptyState
            compact
            title="Flux stable"
            description={
              signals[0]?.message ||
              'Données insuffisantes pour une tendance — effectifs instantanés uniquement.'
            }
          />
        ) : (
          actionable.map((signal, index) => (
            <div
              key={`${signal.type}-${signal.scope}-${index}`}
              className="rounded-xl border border-border bg-background/50 px-3 py-2 text-xs"
            >
              <p className="font-semibold text-text-primary">{signal.message}</p>
              {signal.numerator != null ? (
                <p className="text-xs text-text-secondary mt-0.5">
                  Mesure : {signal.numerator}
                  {signal.denominator != null ? ` / ${signal.denominator}` : ''}
                  {signal.window ? ` · ${signal.window}` : ''}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
