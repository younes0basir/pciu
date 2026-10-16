import { useMemo, useState } from 'react'
import {
  BedDouble,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'
import { CapacityBanner } from '@/components/workflow/CapacityBanner.jsx'
import { PriorityBadge } from '@/components/ui/StatusBadge.jsx'
import { EmptyState } from '@/components/ui/EmptyState.jsx'
import { cn } from '@/lib/utils.js'
import { confirmBedReady } from '@/api/workflow.js'
import { isBedImmediatelyAvailable } from '@/lib/resourceUtils.js'

function formatDuration(minutes) {
  if (minutes == null) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

export function ChiefResourceOverviewPanel({
  beds = [],
  stuckAlerts = [],
  _sla = null,
  showCapacity = true,
  onSelectVisit,
  onOpenFullBedPlan,
  onBedUpdated,
}) {
  const [selectedZone, setSelectedZone] = useState('all')
  const [bedBusyId, setBedBusyId] = useState(null)

  // Group beds by zone and room
  const zones = useMemo(() => {
    const zoneMap = new Map()
    for (const b of beds) {
      const zName = b.zoneName || 'Sans zone'
      if (!zoneMap.has(zName)) {
        zoneMap.set(zName, {
          name: zName,
          color: b.zoneColor || '#64748b',
          rooms: new Map(),
          total: 0,
          occupied: 0,
          readyFree: 0,
        })
      }
      const z = zoneMap.get(zName)
      z.total += 1
      if (b.occupied) z.occupied += 1
      else if (isBedImmediatelyAvailable(b)) {
        z.readyFree += 1
      }

      const rName = b.roomName || 'Salle commune'
      if (!z.rooms.has(rName)) {
        z.rooms.set(rName, {
          name: rName,
          beds: [],
        })
      }
      z.rooms.get(rName).beds.push(b)
    }

    return Array.from(zoneMap.values()).map((z) => ({
      ...z,
      rooms: Array.from(z.rooms.values()),
    }))
  }, [beds])

  const filteredZones = useMemo(() => {
    if (selectedZone === 'all') return zones
    return zones.filter((z) => z.name === selectedZone)
  }, [zones, selectedZone])

  // Count totals for summary
  const totals = useMemo(() => {
    let total = beds.length
    let occupied = 0
    let readyFree = 0
    let cleaning = 0
    let maintenanceOrBlocked = 0

    for (const b of beds) {
      if (b.occupied) occupied += 1
      else {
        const op = b.operationalStatus || 'ready'
        if (op === 'ready' || op === 'available') readyFree += 1
        else if (op === 'cleaning') cleaning += 1
        else maintenanceOrBlocked += 1
      }
    }
    return { total, occupied, readyFree, cleaning, maintenanceOrBlocked }
  }, [beds])

  return (
    <div className="space-y-4">
      {/* 1. CAPACITY BANNER */}
      {showCapacity ? <CapacityBanner /> : null}

      {/* 2. SIGNALS & SLA STUCK ALERTS */}
      <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm shadow-slate-300/25 backdrop-blur-sm">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-lg bg-orange-100 text-orange-800">
              <ShieldAlert className="size-3.5" aria-hidden="true" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
              Signaux SLA & Blocages
            </h3>
          </div>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-black',
              stuckAlerts.length > 0
                ? 'bg-orange-100 text-orange-900 border border-orange-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            )}
          >
            {stuckAlerts.length} alerte(s)
          </span>
        </div>

        {stuckAlerts.length === 0 ? (
          <EmptyState
            compact={true}
            icon={CheckCircle2}
            title="Aucun blocage SLA actif"
            description="Toutes les étapes respectent les seuils configurés."
          />
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {stuckAlerts.slice(0, 6).map((alert) => {
              const isDanger = alert.stuckLevel === 'danger'
              return (
                <div
                  key={alert.visitId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectVisit?.(alert.visitId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectVisit?.(alert.visitId)
                    }
                  }}
                  className={cn(
                    'flex items-center justify-between gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition hover:shadow-2xs',
                    isDanger
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950 hover:bg-rose-100/60'
                      : 'bg-amber-50/70 border-amber-200 text-amber-950 hover:bg-amber-100/60'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PriorityBadge priority={alert.priority} criticalFlag={alert.criticalFlag} size="sm" />
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs truncate">
                        {alert.patientName}{' '}
                        <span className="font-mono text-[11px] opacity-75">({alert.publicCode})</span>
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        Étape : <strong className="text-text-primary">{alert.status}</strong> · {alert.bedLabel || alert.zoneName || 'Attente'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 font-extrabold text-xs">
                      <Clock className="size-3" />
                      {formatDuration(alert.minutesInStep)}
                    </span>
                    <p className="text-[11px] font-medium opacity-80">
                      seuil dépassé
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. MINI PLAN DES RESSOURCES & LITS */}
      <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm shadow-slate-300/25 backdrop-blur-sm">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                <BedDouble className="size-3.5" aria-hidden="true" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Plateau des lits & ressources
              </h3>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {totals.readyFree} prêt(s) libre(s) · {totals.occupied} occupé(s) · {totals.total} total
            </p>
          </div>

          {onOpenFullBedPlan ? (
            <button
              type="button"
              onClick={onOpenFullBedPlan}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              Vue complète
              <ExternalLink className="size-3" />
            </button>
          ) : null}
        </div>

        {/* EXPLICIT LEGEND */}
        <div className="flex flex-wrap items-center gap-2 py-1.5 px-2 bg-surface-muted/60 rounded-xl border border-border/60 text-[11px] text-text-secondary mb-3">
          <span className="font-bold text-text-primary">Légende :</span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" /> Prêt libre
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-slate-700" /> Occupé
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" /> Nettoyage
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-rose-500" /> Bloqué / Maint.
          </span>
        </div>

        {/* ZONE FILTER CHIPS */}
        {zones.length > 1 ? (
          <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar mb-2">
            <button
              type="button"
              onClick={() => setSelectedZone('all')}
              className={cn(
                'rounded-lg px-2 py-0.5 text-xs font-bold border transition shrink-0',
                selectedZone === 'all'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-text-secondary border-border hover:bg-surface-muted'
              )}
            >
              Toutes ({beds.length})
            </button>
            {zones.map((z) => (
              <button
                key={z.name}
                type="button"
                onClick={() => setSelectedZone(z.name)}
                className={cn(
                  'rounded-lg px-2 py-0.5 text-xs font-bold border transition shrink-0',
                  selectedZone === z.name
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-text-secondary border-border hover:bg-surface-muted'
                )}
              >
                {z.name} ({z.total})
              </button>
            ))}
          </div>
        ) : null}

        {/* GRID OF BEDS BY ZONE & ROOM */}
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {filteredZones.map((zone) => (
            <div key={zone.name} className="rounded-xl border border-border/80 bg-surface-muted/20 p-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-text-primary mb-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: zone.color }}
                  />
                  {zone.name}
                </span>
                <span className="text-[11px] text-text-secondary">
                  {zone.readyFree} prêt(s) / {zone.total}
                </span>
              </div>

              <div className="space-y-2">
                {zone.rooms.map((room) => (
                  <div key={room.name}>
                    <p className="text-[11px] font-semibold text-text-secondary mb-1">
                      {room.name}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {room.beds.map((bed) => {
                        const isOccupied = Boolean(bed.occupied)
                        const op = bed.operationalStatus || 'ready'
                        const isReady = !isOccupied && (op === 'ready' || op === 'available')
                        const isCleaning = op === 'cleaning'
                        const isBlocked = ['maintenance', 'blocked', 'out_of_service'].includes(op)

                        let tileStyle = 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100/70'
                        if (isOccupied) {
                          tileStyle = 'bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200/70'
                        } else if (isCleaning) {
                          tileStyle = 'bg-amber-50 border-amber-300 text-amber-950'
                        } else if (isBlocked) {
                          tileStyle = 'bg-rose-50 border-rose-300 text-rose-950'
                        }

                        return (
                          <div
                            key={bed.bedId}
                            role={bed.visitId ? 'button' : undefined}
                            tabIndex={bed.visitId ? 0 : undefined}
                            onClick={() => {
                              if (bed.visitId) onSelectVisit?.(bed.visitId)
                            }}
                            onKeyDown={(e) => {
                              if (bed.visitId && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault()
                                onSelectVisit?.(bed.visitId)
                              }
                            }}
                            title={
                              isOccupied
                                ? `${bed.bedLabel}: Occupé par ${bed.patientName || 'patient'} (${bed.publicCode || '—'}). Cliquer pour ouvrir le dossier.`
                                : `${bed.bedLabel}: Statut ${op}`
                            }
                            className={cn(
                              'flex flex-col p-2 rounded-lg border text-left transition-all',
                              tileStyle,
                              bed.visitId && 'cursor-pointer hover:shadow-xs active:scale-[0.98]'
                            )}
                          >
                            {isCleaning ? (
                              <button
                                type="button"
                                disabled={bedBusyId === bed.bedId}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  setBedBusyId(bed.bedId)
                                  try {
                                    await confirmBedReady(bed.bedId, {
                                      note: 'Nettoyage vérifié',
                                    })
                                    onBedUpdated?.()
                                  } finally {
                                    setBedBusyId(null)
                                  }
                                }}
                                className="mb-1 w-full rounded-md border border-amber-400 bg-white px-1 py-0.5 text-[9px] font-bold uppercase text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                              >
                                Confirmer prêt
                              </button>
                            ) : null}
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-extrabold text-xs truncate">{bed.bedLabel}</span>
                              <span
                                className={cn(
                                  'size-2 rounded-full shrink-0',
                                  isOccupied
                                    ? 'bg-slate-700'
                                    : isReady
                                    ? 'bg-emerald-500'
                                    : isCleaning
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                )}
                              />
                            </div>

                            <p className="mt-1 text-[11px] font-medium truncate">
                              {isOccupied ? (
                                <span className="font-bold text-text-primary">
                                  {bed.patientName || bed.publicCode}
                                </span>
                              ) : isCleaning ? (
                                'Nettoyage'
                              ) : isBlocked ? (
                                op
                              ) : (
                                'Prêt & libre'
                              )}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
