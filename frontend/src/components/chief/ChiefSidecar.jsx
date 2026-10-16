import { AlertCircle, BedDouble, GitBranch, Handshake } from 'lucide-react'

import { CapacityBanner } from '@/components/workflow/CapacityBanner.jsx'
import { OperationalAlertCenter } from '@/components/chief/OperationalAlertCenter.jsx'
import { BottleneckPanel } from '@/components/chief/BottleneckPanel.jsx'
import { TeamCoordinationPanel } from '@/components/chief/TeamCoordinationPanel.jsx'
import { ChiefResourceOverviewPanel } from '@/components/chief/ChiefResourceOverviewPanel.jsx'
import { cn } from '@/lib/utils.js'

/**
 * Decisive right rail for the chief command center.
 * A single segmented control switches between the four operational lenses so the
 * column stays calm — no card-on-card stacking and no nested tab layers.
 */
export function ChiefSidecar({
  supervision,
  overview,
  activeTab = 'alerts',
  onTabChange,
  alertAckBusyId = null,
  onSelectVisit,
  onAcknowledge,
  onOpenFullBedPlan,
  onBedUpdated,
  onOpenTeams,
}) {
  const alerts = supervision?.alerts ?? []
  const bottlenecks = supervision?.bottlenecks ?? []
  const actionableBottlenecks = bottlenecks.filter((signal) => signal.type !== 'no_major_bottleneck')
  const coordination = supervision?.coordination
  const coordinationTotal =
    (coordination?.pendingHandoffs?.length ?? 0) + (coordination?.pendingTransfers?.length ?? 0)

  const tabs = [
    { id: 'alerts', label: 'Alertes', icon: AlertCircle, count: alerts.length },
    { id: 'resources', label: 'Lits', icon: BedDouble, count: null },
    { id: 'coordination', label: 'Coordination', icon: Handshake, count: coordinationTotal },
    { id: 'bottlenecks', label: 'Goulots', icon: GitBranch, count: actionableBottlenecks.length },
  ]

  return (
    <div className="space-y-3">
      <CapacityBanner />

      <div
        role="tablist"
        aria-label="Panneau opérationnel du chef de service"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-slate-100/70 p-1"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                'inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                active
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
              {tab.count ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] font-black tabular-nums',
                    active ? 'bg-primary text-white' : 'bg-white text-slate-500'
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {activeTab === 'alerts' ? (
        <OperationalAlertCenter
          alerts={alerts}
          loading={supervision?.loading}
          filter={supervision?.alertFilter}
          onFilterChange={supervision?.setAlertFilter}
          ackBusyId={alertAckBusyId}
          onSelectVisit={onSelectVisit}
          onAcknowledge={onAcknowledge}
        />
      ) : null}

      {activeTab === 'resources' ? (
        <ChiefResourceOverviewPanel
          beds={overview?.beds || []}
          stuckAlerts={overview?.stuckAlerts || []}
          sla={overview?.sla}
          showCapacity={false}
          onSelectVisit={onSelectVisit}
          onOpenFullBedPlan={onOpenFullBedPlan}
          onBedUpdated={onBedUpdated}
        />
      ) : null}

      {activeTab === 'coordination' ? (
        <TeamCoordinationPanel
          coordination={coordination}
          onSelectVisit={onSelectVisit}
          onOpenTeams={onOpenTeams}
        />
      ) : null}

      {activeTab === 'bottlenecks' ? <BottleneckPanel signals={bottlenecks} /> : null}
    </div>
  )
}
