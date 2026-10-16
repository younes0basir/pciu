import { useState } from 'react'
import { ChevronDown, ChevronUp, History } from 'lucide-react'
import { ChiefActiveTable } from '@/components/chief/ChiefActiveTable.jsx'
import { ChiefClosedTodayTable } from '@/components/chief/ChiefClosedTodayTable.jsx'
import { dashboardPanelClass } from '@/components/layout/dashboardStyles.js'
import { cn } from '@/lib/utils.js'

export function ChiefHistorySection({
  activeVisits = [],
  closedVisits = [],
  onSelectVisit,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [activeTab, setActiveTab] = useState('closed') // 'closed' | 'active'

  return (
    <section className={cn('overflow-hidden transition-all', dashboardPanelClass)}>
      <header
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
        className="flex items-center justify-between px-5 py-4 cursor-pointer transition hover:bg-slate-50/70"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-surface border border-border text-text-secondary">
            <History className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
              <span>Registres secondaires & Historique</span>
              <span className="rounded-full bg-violet-100 text-violet-900 border border-violet-200 px-2 py-0.2 text-[10px] font-black">
                {closedVisits.length} clôturée(s)
              </span>
            </h3>
            <p className="text-[11px] text-text-secondary">
              Visites clôturées aujourd'hui, temps de séjour complet et registre global des urgences.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
          <span>{expanded ? 'Masquer' : 'Afficher'}</span>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </header>

      {expanded ? (
        <div className="p-4 border-t border-border space-y-4">
          <div className="flex gap-2 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('closed')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition border',
                activeTab === 'closed'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                  : 'bg-surface text-text-secondary border-border hover:bg-surface-muted'
              )}
            >
              Clôturées aujourd’hui ({closedVisits.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition border',
                activeTab === 'active'
                  ? 'bg-primary text-white border-primary shadow-2xs'
                  : 'bg-surface text-text-secondary border-border hover:bg-surface-muted'
              )}
            >
              Toutes les visites actives ({activeVisits.length})
            </button>
          </div>

          {activeTab === 'closed' ? (
            <ChiefClosedTodayTable visits={closedVisits} onSelectVisit={onSelectVisit} />
          ) : (
            <ChiefActiveTable visits={activeVisits} onSelectVisit={onSelectVisit} />
          )}
        </div>
      ) : null}
    </section>
  )
}
