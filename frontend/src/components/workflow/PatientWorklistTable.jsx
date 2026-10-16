import { useMemo } from 'react'
import {
  BedDouble,
  ChevronRight,
  Clock,
  FileText,
  ListChecks,
  Loader2,
  PhoneCall,
  RefreshCw,
  Search,
} from 'lucide-react'
import { PriorityBadge, PatientStatusBadge } from '@/components/ui/StatusBadge.jsx'
import { EmptyState } from '@/components/ui/EmptyState.jsx'
import { dashboardPanelClass } from '@/components/layout/dashboardStyles.js'
import { cn } from '@/lib/utils.js'

export const WORKLIST_DEF = [
  { id: 'triage', label: 'À trier', key: 'triage', desc: 'Arrivés, en attente de premier triage infirmier' },
  { id: 'care', label: 'Attente soins', key: 'care', desc: 'Triés, en attente de prise en charge clinique ou lit' },
  { id: 'inCare', label: 'En soins', key: 'inCare', desc: 'Consultation ou soins en cours' },
  { id: 'observation', label: 'Observation', key: 'observation', desc: 'Placés sous surveillance continue' },
  { id: 'disposition', label: 'Disposition', key: 'disposition', desc: 'Orientation finale validée, en attente de transfert/sortie' },
  { id: 'reassessment', label: 'À réévaluer', key: 'reassessment', desc: 'Délai de réévaluation clinique dépassé (>60 min)' },
  { id: 'exams', label: 'Examens', key: 'exams', desc: 'Biologie ou imagerie en attente de résultat' },
]

function formatWait(minutes) {
  if (minutes == null) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

function computeMinutesFrom(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
}

const SELECT_CLASS =
  'rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-primary'

export function PatientWorklistTable({
  worklists = null,
  loading = false,
  error = null,
  onRefresh = null,
  activeTab = 'triage',
  onTabChange,
  onSelectVisit,
  // Optional search & filters
  searchQuery = '',
  priorityFilter = 'all',
  zoneFilter = 'all',
  onSearchChange,
  onPriorityFilterChange,
  onZoneFilterChange,
  // Role capabilities
  canCall = false,
  canPlace = false,
  canStartConsultation = false,
  onQuickCall = null,
  onQuickPlace = null,
  actionBusy = false,
  lead = null,
}) {
  const currentTab = WORKLIST_DEF.find((t) => t.id === activeTab) || WORKLIST_DEF[0]

  const totalCount = useMemo(() => {
    if (!worklists) return 0
    return WORKLIST_DEF.reduce((sum, def) => sum + (worklists[def.key]?.length || 0), 0)
  }, [worklists])

  const rawRows = useMemo(() => {
    if (!worklists) return []
    return worklists[currentTab.key] || []
  }, [worklists, currentTab.key])

  const filteredRows = useMemo(() => {
    let rows = rawRows
    if (priorityFilter !== 'all') {
      const pMax = Number(priorityFilter)
      rows = rows.filter((r) => r.priority != null && Number(r.priority) <= pMax)
    }
    if (zoneFilter !== 'all') {
      if (zoneFilter === '__none__') {
        rows = rows.filter((r) => !r.zoneName && !r.bedLabel)
      } else {
        rows = rows.filter((r) => r.zoneName === zoneFilter)
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      rows = rows.filter((r) => {
        const text = [
          r.patientName,
          r.publicCode,
          r.nationalId,
          r.chiefComplaint,
          r.bedLabel,
          r.roomName,
          r.zoneName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return text.includes(q)
      })
    }
    return rows
  }, [rawRows, priorityFilter, zoneFilter, searchQuery])

  const availableZones = useMemo(() => {
    if (!worklists) return []
    const zones = new Set()
    for (const def of WORKLIST_DEF) {
      for (const row of worklists[def.key] || []) {
        if (row.zoneName) zones.add(row.zoneName)
      }
    }
    return Array.from(zones).sort()
  }, [worklists])

  const hasActiveFilters = Boolean(searchQuery) || priorityFilter !== 'all' || zoneFilter !== 'all'
  const showToolbar = Boolean(onSearchChange || onPriorityFilterChange || onZoneFilterChange)

  return (
    <section className={cn('flex flex-col overflow-hidden', dashboardPanelClass)}>
      {/* HEADER + TOOLBAR */}
      <div className="border-b border-slate-100/90 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <ListChecks className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-text-primary">
                <span>Flux patients</span>
                <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-black tabular-nums text-text-secondary">
                  {totalCount}
                </span>
              </h2>
              <p className="truncate text-xs text-text-secondary">{currentTab.desc}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showToolbar ? (
              <>
                {onSearchChange ? (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder="Rechercher…"
                      className="w-40 rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2.5 text-xs text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-1 focus:ring-primary sm:w-52"
                    />
                  </div>
                ) : null}

                {onPriorityFilterChange ? (
                  <select
                    value={priorityFilter}
                    onChange={(e) => onPriorityFilterChange(e.target.value)}
                    className={SELECT_CLASS}
                    aria-label="Filtrer par priorité"
                  >
                    <option value="all">Priorités</option>
                    <option value="2">P1–P2</option>
                    <option value="3">P1–P3</option>
                    <option value="5">P1–P5</option>
                  </select>
                ) : null}

                {onZoneFilterChange && availableZones.length > 0 ? (
                  <select
                    value={zoneFilter}
                    onChange={(e) => onZoneFilterChange(e.target.value)}
                    className={SELECT_CLASS}
                    aria-label="Filtrer par zone"
                  >
                    <option value="all">Zones</option>
                    <option value="__none__">Sans lit</option>
                    {availableZones.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                ) : null}

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange?.('')
                      onPriorityFilterChange?.('all')
                      onZoneFilterChange?.('all')
                    }}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    Effacer
                  </button>
                ) : null}
              </>
            ) : null}

            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                title="Rafraîchir les files"
                aria-label="Rafraîchir les files"
                className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition hover:bg-surface-muted hover:text-text-primary disabled:opacity-60"
              >
                <RefreshCw className={cn('size-3.5', loading && 'animate-spin text-primary')} />
              </button>
            ) : null}
          </div>
        </div>

        {/* SEGMENTED WORKLIST CONTROL */}
        {lead ? <div className="mt-4 border-t border-slate-100/90 pt-4">{lead}</div> : null}

        <div
          role="tablist"
          aria-label="Files de travail d'urgence"
          className="mt-3.5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-slate-100/70 p-1"
        >
          {WORKLIST_DEF.map((t) => {
            const count = worklists?.[t.key]?.length ?? 0
            const active = t.id === activeTab
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(t.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition',
                  active
                    ? 'bg-primary text-white shadow-sm shadow-primary/25'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                )}
              >
                <span>{t.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] font-black tabular-nums',
                    active ? 'bg-white/25 text-white' : 'bg-white text-slate-500'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {error ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      {/* LIST */}
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-26rem)] min-h-[280px]">
        {loading && !worklists ? (
          <div className="p-8 text-center text-xs text-text-secondary">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin text-primary" />
            Chargement de la file de travail…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-3">
            <EmptyState
              compact
              title={`Aucun patient · ${currentTab.label}`}
              description={
                hasActiveFilters
                  ? 'Aucun dossier ne correspond aux filtres actuels.'
                  : 'File libre ou patients déjà pris en charge.'
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredRows.map((row) => {
              const minutesWaiting = row.arrivedAt ? computeMinutesFrom(row.arrivedAt) : null
              const isUrgent = row.priority != null && Number(row.priority) <= 2

              return (
                <li key={row.visitId}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectVisit?.(row.visitId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectVisit?.(row.visitId)
                      }
                    }}
                    className={cn(
                      'group flex cursor-pointer flex-col gap-3 px-5 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between',
                      isUrgent ? 'bg-rose-50/40 hover:bg-rose-50/80' : 'hover:bg-slate-50/80'
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="shrink-0 pt-0.5">
                        <PriorityBadge
                          priority={row.priority}
                          displayPriority={row.displayPriority ?? row.priority}
                          priorityValidated={row.priorityValidated !== false}
                          registrationPriority={row.registrationPriority}
                          criticalFlag={row.criticalFlag}
                          size="md"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-xs font-extrabold text-text-primary transition-colors group-hover:text-primary sm:text-sm">
                            {row.patientName}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-text-secondary">
                            {row.publicCode}
                          </span>
                          {row.nationalId ? (
                            <span className="text-[11px] text-text-secondary/80">CIN {row.nationalId}</span>
                          ) : null}
                        </div>

                        <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
                          {row.chiefComplaint || 'Motif non renseigné'}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary">
                          <PatientStatusBadge careStage={row.careStage} status={row.careStage} />

                          {row.bedLabel ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
                              <BedDouble className="size-3 text-primary" />
                              {row.zoneName ? `${row.zoneName} · ` : ''}
                              {row.bedLabel}
                            </span>
                          ) : (
                            <span>Salle d'attente</span>
                          )}

                          {row.pendingExams != null && row.pendingExams > 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                              <FileText className="size-3" />
                              {row.pendingExams} examen(s)
                            </span>
                          ) : null}

                          {row.callCount != null && row.callCount > 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-sky-800">
                              <PhoneCall className="size-3" />
                              Appelé {row.callCount}×
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/50 pt-2 sm:justify-end sm:border-t-0 sm:pt-0">
                      {minutesWaiting != null ? (
                        <div className="flex items-center gap-1 text-xs font-bold tabular-nums text-text-secondary">
                          <Clock className="size-3 text-text-secondary/70" />
                          {formatWait(minutesWaiting)}
                        </div>
                      ) : null}

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {canCall && (!row.callCount || row.callCount === 0) && onQuickCall ? (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => onQuickCall(row.visitId)}
                            title="Appeler le patient"
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                          >
                            <PhoneCall className="size-3" />
                            <span className="hidden md:inline">Appeler</span>
                          </button>
                        ) : null}

                        {canPlace && !row.bedLabel && onQuickPlace ? (
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => onQuickPlace(row.visitId)}
                            title="Assigner un lit au patient"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <BedDouble className="size-3" />
                            <span className="hidden md:inline">Au lit</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => onSelectVisit?.(row.visitId)}
                          className="flex size-7 items-center justify-center rounded-lg text-text-secondary transition-colors group-hover:bg-primary/10 group-hover:text-primary"
                          aria-label="Ouvrir le dossier patient"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between border-t border-slate-100/90 px-5 py-2.5 text-[11px] text-text-secondary">
        <span>
          <strong className="text-text-primary">{filteredRows.length}</strong> affiché(s)
          {hasActiveFilters ? ` sur ${rawRows.length}` : ''}
        </span>
        <span className="hidden sm:inline">Cliquez une ligne pour ouvrir le dossier</span>
      </div>
    </section>
  )
}
