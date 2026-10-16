import { AccueilCarePathBanner } from '@/components/accueil/AccueilCarePathBanner.jsx'
import { AccueilKpiBar } from '@/components/accueil/AccueilKpiBar.jsx'
import { AccueilPipelineColumn } from '@/components/accueil/AccueilPipelineColumn.jsx'
import { AccueilQueueList } from '@/components/accueil/AccueilQueueList.jsx'
import { dashboardSelectClass } from '@/components/layout/dashboardStyles.js'

/**
 * Shared queue workspace for the Accueil / Nurse / Doctor dashboards.
 * Filter bar + KPI bar + dual pipeline + patient queue table.
 */
export function QueueWorkspace({
  stats,
  pipeline,
  filteredWaiting,
  priorityFilter,
  statusFilter,
  onPriorityFilterChange,
  onStatusFilterChange,
  onSelectVisit,
  uncalledTitle = 'En attente',
  uncalledSubtitle,
  calledTitle = 'En attente',
  calledSubtitle,
  calledTone = 'amber',
  carePathPhase = null,
  leading = null,
}) {
  return (
    <div className="space-y-4">
      {leading}

      {carePathPhase ? (
        <AccueilCarePathBanner phase={carePathPhase} calledCount={stats?.called ?? 0} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={priorityFilter}
          onChange={(event) => onPriorityFilterChange?.(event.target.value)}
          className={dashboardSelectClass}
          aria-label="Filtrer par priorité"
        >
          <option value="all">Toutes priorités</option>
          <option value="2">P1–P2</option>
          <option value="3">P1–P3</option>
          <option value="5">P1–P5</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange?.(event.target.value)}
          className={dashboardSelectClass}
          aria-label="Filtrer par statut d’appel"
        >
          <option value="all">Tous les statuts</option>
          <option value="uncalled">Non appelés</option>
          <option value="called">Appelés</option>
        </select>
        <span className="ml-auto text-[11px] font-semibold text-text-secondary">
          {filteredWaiting.length} affiché(s) · {stats?.total ?? 0} en file
        </span>
      </div>

      <AccueilKpiBar stats={stats} />

      <div className="grid gap-3 lg:grid-cols-2">
        <AccueilPipelineColumn
          title={uncalledTitle}
          subtitle={uncalledSubtitle}
          visits={pipeline?.uncalled ?? []}
          tone="slate"
          onSelectVisit={onSelectVisit}
        />
        <AccueilPipelineColumn
          title={calledTitle}
          subtitle={calledSubtitle}
          visits={pipeline?.called ?? []}
          tone={calledTone}
          onSelectVisit={onSelectVisit}
        />
      </div>

      <AccueilQueueList visits={filteredWaiting} onSelectVisit={onSelectVisit} />
    </div>
  )
}
