import { useMemo, useState } from 'react'
import { BedDouble, Search } from 'lucide-react'

import { priorityBadgeClass, statusLabel } from '@/components/chief/chiefUtils.js'
import { dashboardInputClass } from '@/components/layout/dashboardStyles.js'
import { cn } from '@/lib/utils.js'

const STATUS_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'free', label: 'Libres' },
  { id: 'occupied', label: 'Occupés' },
  { id: 'urgent', label: 'Urgents' },
]

const PRIORITY_RAIL = {
  1: 'bg-rose-500',
  2: 'bg-orange-500',
  3: 'bg-amber-400',
  4: 'bg-sky-500',
  5: 'bg-slate-400',
}

function occupancyTone(ratio) {
  if (ratio >= 0.9) return { bar: 'bg-rose-500', text: 'text-rose-700', label: 'Saturé' }
  if (ratio >= 0.7) return { bar: 'bg-amber-500', text: 'text-amber-800', label: 'Chargé' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-800', label: 'Disponible' }
}

function bedStatusText(bed) {
  if (!bed.occupied) return 'Libre'
  if (bed.visitStatus === 'in_treatment') return 'Consultation'
  if (bed.visitStatus === 'placed') return 'Au lit'
  return statusLabel(bed.visitStatus) || 'Occupé'
}

function patientInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0] || '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}

function formatClock(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function isUrgent(bed) {
  return Boolean(bed.occupied && bed.priority != null && Number(bed.priority) <= 2)
}

function matchesQuery(bed, query) {
  if (!query) return true
  const haystack = [bed.patientName, bed.publicCode, bed.bedLabel, bed.roomName, bed.zoneName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function groupByZone(beds) {
  const zones = []
  const zoneMap = new Map()

  for (const bed of beds) {
    const zoneKey = String(bed.zoneId ?? bed.zoneName ?? 'zone')
    let zone = zoneMap.get(zoneKey)
    if (!zone) {
      zone = {
        key: zoneKey,
        zoneId: bed.zoneId,
        name: bed.zoneName || 'Zone',
        color: bed.zoneColor || '#64748b',
        rooms: [],
        roomMap: new Map(),
      }
      zoneMap.set(zoneKey, zone)
      zones.push(zone)
    }

    const roomKey = String(bed.roomId ?? bed.roomName ?? 'room')
    let room = zone.roomMap.get(roomKey)
    if (!room) {
      room = {
        key: `${zoneKey}-${roomKey}`,
        roomId: bed.roomId,
        name: bed.roomName || 'Salle',
        beds: [],
      }
      zone.roomMap.set(roomKey, room)
      zone.rooms.push(room)
    }
    room.beds.push(bed)
  }

  return zones
}

function deriveZoneOptions(beds, zones) {
  const seen = new Map()
  for (const bed of beds) {
    const id = String(bed.zoneId ?? bed.zoneName ?? '')
    if (!id || seen.has(id)) continue
    seen.set(id, {
      zoneId: bed.zoneId,
      zoneName: bed.zoneName || 'Zone',
      zoneColor: bed.zoneColor || '#64748b',
    })
  }

  if (!zones?.length) return [...seen.values()]

  const ordered = []
  for (const zone of zones) {
    const id = String(zone.zoneId)
    const match = seen.get(id)
    if (!match) continue
    ordered.push(match)
    seen.delete(id)
  }
  return [...ordered, ...seen.values()]
}

function BedTile({ bed, isMine, interactive, actionLabel, onClick }) {
  const occupied = Boolean(bed.occupied)
  const urgent = isUrgent(bed)
  const clock = formatClock(bed.assignedAt)
  const Tag = interactive ? 'button' : 'div'
  const detail = occupied
    ? [bed.publicCode, bedStatusText(bed), clock].filter(Boolean).join(' · ')
    : actionLabel || 'Libre'

  return (
    <li>
      <Tag
        type={interactive ? 'button' : undefined}
        onClick={interactive ? onClick : undefined}
        aria-label={
          interactive
            ? `${bed.bedLabel}, ${bed.roomName}, ${occupied ? `${bed.patientName || 'patient'}, ${bedStatusText(bed)}` : 'libre'}. ${actionLabel}`
            : undefined
        }
        className={cn(
          'flex min-h-16 w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm shadow-slate-900/5',
          occupied ? 'border-slate-200' : 'border-dashed border-emerald-300/90 bg-white/80',
          interactive &&
            'cursor-pointer transition hover:border-sky-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/25 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0',
          !interactive && occupied && 'opacity-95'
        )}
      >
        <span
          className={cn('w-1.5 shrink-0', occupied ? PRIORITY_RAIL[bed.priority] || 'bg-sky-500' : 'bg-emerald-500')}
          aria-hidden="true"
        />
        <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold',
              occupied ? 'bg-slate-900 text-white' : 'bg-emerald-50 text-emerald-700'
            )}
          >
            {occupied ? (
              patientInitials(bed.patientName)
            ) : (
              <BedDouble className="size-5" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-extrabold text-slate-900">{bed.bedLabel}</span>
              {occupied && bed.priority ? (
                <span
                  className={cn(
                    'shrink-0 rounded-md px-1.5 py-0.5 text-xs font-extrabold ring-1 ring-inset',
                    priorityBadgeClass(bed.priority)
                  )}
                >
                  P{bed.priority}
                </span>
              ) : null}
            </span>
            <span className={cn('mt-0.5 block truncate text-sm font-semibold', occupied ? 'text-slate-800' : 'text-emerald-800')}>
              {occupied ? bed.patientName || 'Patient' : 'Libre'}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-semibold text-slate-600">
              {urgent ? (
                <span className="relative flex size-2 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex size-full rounded-full bg-rose-400 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
                </span>
              ) : null}
              <span className="truncate">
                {detail}
                {!interactive && occupied && !isMine ? ' · Autre salle' : ''}
              </span>
            </span>
          </span>
        </span>
      </Tag>
    </li>
  )
}

function RoomBay({ room, zone, highlightRoomId, assignFreeBeds, restrictOccupiedToRoom, onSelectOccupied, onSelectFree }) {
  const isMine = highlightRoomId != null && Number(room.roomId) === Number(highlightRoomId)
  const occupied = room.beds.filter((bed) => bed.occupied).length
  const total = room.beds.length
  const ratio = total ? occupied / total : 0
  const hasUrgent = room.beds.some(isUrgent)

  return (
    <article
      className={cn(
        '@container overflow-hidden rounded-3xl border bg-white shadow-md shadow-slate-900/10',
        isMine ? 'border-sky-400 ring-2 ring-sky-400/70' : 'border-slate-800/10'
      )}
    >
      <header className="relative overflow-hidden bg-slate-900 px-4 py-3 text-white">
        <span
          className="pointer-events-none absolute -top-10 -right-8 size-28 rounded-full opacity-70 blur-2xl"
          style={{ backgroundColor: zone.color }}
          aria-hidden="true"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold tracking-[0.14em] text-slate-300 uppercase">{zone.name}</p>
            <h3 className="truncate text-base font-extrabold">{room.name}</h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {isMine ? (
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-slate-900">
                Votre salle
              </span>
            ) : null}
            {hasUrgent ? (
              <span className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-extrabold text-white">Urgent</span>
            ) : null}
          </div>
        </div>
        <div className="relative mt-3 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={occupied}
            aria-label={`Occupation de ${room.name}`}
          >
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
          <p className="text-xs font-extrabold tabular-nums text-white">
            {occupied}/{total}
          </p>
        </div>
      </header>
      <ul className="bed-plan-floor grid grid-cols-1 gap-2 p-3 @sm:grid-cols-2">
        {room.beds.map((bed) => {
          const canOpen = Boolean(bed.occupied && bed.visitId && onSelectOccupied && (!restrictOccupiedToRoom || isMine))
          const canAssign = Boolean(assignFreeBeds && !bed.occupied && onSelectFree)
          const interactive = canOpen || canAssign
          const actionLabel = canOpen ? 'Ouvrir le dossier' : canAssign ? 'Affecter un patient' : 'Disponible'
          return (
            <BedTile
              key={bed.bedId}
              bed={bed}
              isMine={isMine}
              interactive={interactive}
              actionLabel={actionLabel}
              onClick={() => {
                if (canOpen) onSelectOccupied(bed.visitId)
                else if (canAssign) onSelectFree(bed)
              }}
            />
          )
        })}
      </ul>
    </article>
  )
}

export function BedPlanPanel({
  beds,
  zones,
  highlightRoomId,
  onSelectOccupied,
  onSelectFree,
  assignFreeBeds = true,
  restrictOccupiedToRoom = false,
  title = 'Salles & lits — hôpital',
  subtitle,
}) {
  const [query, setQuery] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const allBeds = beds || []
  const zoneOptions = useMemo(() => deriveZoneOptions(allBeds, zones), [allBeds, zones])
  const normalizedQuery = query.trim().toLowerCase()

  const scoped = useMemo(() => {
    return allBeds.filter((bed) => {
      if (zoneFilter !== 'all' && String(bed.zoneId) !== zoneFilter) return false
      if (statusFilter === 'mine' && Number(bed.roomId) !== Number(highlightRoomId)) return false
      return matchesQuery(bed, normalizedQuery)
    })
  }, [allBeds, zoneFilter, statusFilter, highlightRoomId, normalizedQuery])

  const visible = useMemo(() => {
    return scoped.filter((bed) => {
      if (statusFilter === 'free') return !bed.occupied
      if (statusFilter === 'occupied') return bed.occupied
      if (statusFilter === 'urgent') return isUrgent(bed)
      return true
    })
  }, [scoped, statusFilter])

  const counts = useMemo(() => {
    const occupied = allBeds.filter((bed) => bed.occupied).length
    return {
      total: allBeds.length,
      occupied,
      free: allBeds.length - occupied,
      urgent: allBeds.filter(isUrgent).length,
    }
  }, [allBeds])

  const chipCounts = useMemo(() => {
    const base = allBeds.filter((bed) => {
      if (zoneFilter !== 'all' && String(bed.zoneId) !== zoneFilter) return false
      return matchesQuery(bed, normalizedQuery)
    })
    return {
      all: base.length,
      free: base.filter((bed) => !bed.occupied).length,
      occupied: base.filter((bed) => bed.occupied).length,
      urgent: base.filter(isUrgent).length,
      mine: base.filter((bed) => Number(bed.roomId) === Number(highlightRoomId)).length,
    }
  }, [allBeds, zoneFilter, normalizedQuery, highlightRoomId])

  const grouped = useMemo(() => groupByZone(visible), [visible])
  const ratio = counts.total ? counts.occupied / counts.total : 0
  const tone = occupancyTone(ratio)
  const pct = Math.round(ratio * 100)
  const filtersActive = Boolean(normalizedQuery) || zoneFilter !== 'all' || statusFilter !== 'all'

  if (!allBeds.length) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-4 py-12 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <BedDouble className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-extrabold text-slate-900">Plan des lits indisponible</p>
        <p className="mt-1 text-sm font-medium text-slate-600">Aucune salle n’est configurée pour le moment.</p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-sm shadow-slate-300/30">
      <header className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-extrabold tracking-[0.16em] text-sky-700 uppercase">Hôpital</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm font-medium text-slate-600">
              {subtitle ??
                `${counts.free} libre${counts.free === 1 ? '' : 's'} · ${counts.occupied} occupé${counts.occupied === 1 ? '' : 's'}`}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[28rem]">
            <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
              <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">Occupation</dt>
              <dd className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-900">{pct}%</dd>
              <dd className={cn('text-xs font-extrabold', tone.text)}>{tone.label}</dd>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-2.5">
              <dt className="text-xs font-bold tracking-wide text-emerald-800 uppercase">Libres</dt>
              <dd className="mt-0.5 text-2xl font-extrabold tabular-nums text-emerald-950">{counts.free}</dd>
            </div>
            <div className="rounded-2xl bg-sky-50 px-3 py-2.5">
              <dt className="text-xs font-bold tracking-wide text-sky-800 uppercase">Occupés</dt>
              <dd className="mt-0.5 text-2xl font-extrabold tabular-nums text-sky-950">{counts.occupied}</dd>
            </div>
            <div className="rounded-2xl bg-rose-50 px-3 py-2.5">
              <dt className="text-xs font-bold tracking-wide text-rose-800 uppercase">Urgents</dt>
              <dd className="mt-0.5 text-2xl font-extrabold tabular-nums text-rose-950">{counts.urgent}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Taux d’occupation</p>
            <p className="text-xs font-semibold text-slate-600">
              {counts.occupied} sur {counts.total}
            </p>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-slate-100"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`Taux d’occupation ${pct} pour cent, ${tone.label}`}
          >
            <div
              className={cn('h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500', tone.bar)}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <label className="relative block sm:max-w-sm">
            <span className="sr-only">Rechercher un lit ou un patient</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Patient, code, lit, salle…"
              className={cn(dashboardInputClass, 'pl-10')}
            />
          </label>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les lits">
            {STATUS_FILTERS.map((filter) => {
              const selected = statusFilter === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setStatusFilter(filter.id)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/25',
                    selected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {filter.label}
                  <span className={cn('tabular-nums', selected ? 'text-white/75' : 'text-slate-500')}>
                    {chipCounts[filter.id]}
                  </span>
                </button>
              )
            })}
            {highlightRoomId != null ? (
              <button
                type="button"
                aria-pressed={statusFilter === 'mine'}
                onClick={() => setStatusFilter((current) => (current === 'mine' ? 'all' : 'mine'))}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/25',
                  statusFilter === 'mine' ? 'bg-sky-700 text-white' : 'bg-sky-50 text-sky-900 ring-1 ring-sky-200 hover:bg-sky-100'
                )}
              >
                Ma salle
                <span className={cn('tabular-nums', statusFilter === 'mine' ? 'text-white/80' : 'text-sky-700')}>
                  {chipCounts.mine}
                </span>
              </button>
            ) : null}
          </div>

          {zoneOptions.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par zone">
              <button
                type="button"
                aria-pressed={zoneFilter === 'all'}
                onClick={() => setZoneFilter('all')}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/25',
                  zoneFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                )}
              >
                Toutes les zones
              </button>
              {zoneOptions.map((zone) => {
                const selected = zoneFilter === String(zone.zoneId)
                return (
                  <button
                    key={zone.zoneId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setZoneFilter((current) => (current === String(zone.zoneId) ? 'all' : String(zone.zoneId)))}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/25',
                      selected ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <span
                      className="size-2.5 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: zone.zoneColor || '#64748b' }}
                      aria-hidden="true"
                    />
                    {zone.zoneName}
                  </button>
                )
              })}
            </div>
          ) : null}

          {restrictOccupiedToRoom ? (
            <p className="text-xs font-semibold text-slate-600">
              Les autres salles restent visibles. Seuls les patients de votre salle s’ouvrent.
            </p>
          ) : null}
          {assignFreeBeds ? (
            <p className="text-xs font-semibold text-slate-600">Touchez un lit libre pour y affecter un patient.</p>
          ) : null}
        </div>
      </header>

      <div className="bed-plan-floor space-y-6 p-4 sm:p-5" aria-live="polite">
        {grouped.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-4 py-10 text-center">
            <p className="text-sm font-extrabold text-slate-900">Aucun lit pour ce filtre</p>
            <p className="mt-1 text-sm font-medium text-slate-600">Élargissez la recherche ou réinitialisez les filtres.</p>
            {filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setZoneFilter('all')
                  setStatusFilter('all')
                }}
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-slate-900 px-4 text-sm font-extrabold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/30"
              >
                Réinitialiser
              </button>
            ) : null}
          </div>
        ) : (
          grouped.map((zone) => (
            <div key={zone.key} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="h-2 w-8 rounded-full" style={{ backgroundColor: zone.color }} aria-hidden="true" />
                <h3 className="text-sm font-extrabold tracking-tight text-slate-800">{zone.name}</h3>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {zone.rooms.map((room) => (
                  <RoomBay
                    key={room.key}
                    room={room}
                    zone={zone}
                    highlightRoomId={highlightRoomId}
                    assignFreeBeds={assignFreeBeds}
                    restrictOccupiedToRoom={restrictOccupiedToRoom}
                    onSelectOccupied={onSelectOccupied}
                    onSelectFree={onSelectFree}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
