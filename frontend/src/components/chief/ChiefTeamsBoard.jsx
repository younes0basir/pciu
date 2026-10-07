import { useMemo, useState } from 'react'
import { DoorOpen, HeartPulse, Search, Stethoscope, UserRound } from 'lucide-react'

import { ChiefTeamDialog } from '@/components/chief/ChiefTeamDialog.jsx'
import { clinicianLabel, personInitials } from '@/components/chief/chiefUtils.js'

const COVERAGE_FILTERS = [
  { id: 'all', label: 'Toutes les salles' },
  { id: 'open', label: 'Sans responsable' },
  { id: 'partial', label: 'Sans infirmière' },
  { id: 'staffed', label: 'Équipe complète' },
]

function coverageOf(room) {
  if (!room.doctor) return 'open'
  if (!room.nurses?.length) return 'partial'
  return 'staffed'
}

export function ChiefTeamsBoard({ board, currentUserId, busy, onSave, onClear }) {
  const [search, setSearch] = useState('')
  const [coverage, setCoverage] = useState('all')
  const [editor, setEditor] = useState(null)

  const zones = board?.zones || []
  const clinicians = board?.clinicians || []
  const nurses = board?.nurses || []

  const rooms = useMemo(
    () => zones.flatMap((zone) => zone.rooms.map((room) => ({ ...room, zoneName: zone.name, zoneColor: zone.color }))),
    [zones]
  )

  const stats = useMemo(() => {
    const covered = rooms.filter((room) => room.doctor).length
    return {
      rooms: rooms.length,
      covered,
      open: rooms.length - covered,
      nursesLinked: nurses.filter((nurse) => nurse.assignedRoomId).length,
      cliniciansFree: clinicians.filter((person) => !person.assignedRoomId).length,
    }
  }, [rooms, nurses, clinicians])

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rooms.filter((room) => {
      if (coverage !== 'all' && coverageOf(room) !== coverage) return false
      if (!q) return true
      const haystack = [
        room.name,
        room.zoneName,
        room.doctor ? `${room.doctor.firstName} ${room.doctor.lastName}` : '',
        ...(room.nurses || []).map((nurse) => `${nurse.firstName} ${nurse.lastName}`),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [rooms, search, coverage])

  const freeClinicians = clinicians.filter((person) => !person.assignedRoomId)
  const freeNurses = nurses.filter((person) => !person.assignedRoomId)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={DoorOpen} label="Salles couvertes" value={`${stats.covered}/${stats.rooms}`} tone="bg-amber-100 text-amber-800" />
        <Stat icon={Stethoscope} label="Salles ouvertes" value={stats.open} tone="bg-rose-100 text-rose-700" />
        <Stat icon={HeartPulse} label="Infirmières liées" value={stats.nursesLinked} tone="bg-sky-100 text-sky-800" />
        <Stat icon={UserRound} label="Médecins libres" value={stats.cliniciansFree} tone="bg-emerald-100 text-emerald-800" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Salle, médecin, infirmière…"
            className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm font-medium shadow-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 sm:w-72"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les salles">
          {COVERAGE_FILTERS.map((filter) => {
            const selected = coverage === filter.id
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setCoverage(filter.id)}
                className={`min-h-11 rounded-full px-3.5 text-xs font-extrabold ${
                  selected
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRooms.length === 0 ? (
            <p className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm font-semibold text-slate-500">
              Aucune salle ne correspond à ce filtre.
            </p>
          ) : (
            filteredRooms.map((room) => (
              <RoomCard key={room.roomId} room={room} onEdit={() => setEditor(room)} />
            ))
          )}
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs xl:sticky xl:top-24">
          <h2 className="text-sm font-extrabold text-slate-900">Disponibles</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Personnes qui ne sont encore chargées d’aucune salle.
          </p>
          <Roster title="Médecins" people={freeClinicians} empty="Tous les médecins ont une salle." tone="amber" />
          <Roster title="Infirmières" people={freeNurses} empty="Toutes les infirmières sont liées." tone="sky" />
        </aside>
      </div>

      {editor ? (
        <ChiefTeamDialog
          room={editor}
          zoneName={editor.zoneName}
          clinicians={clinicians}
          nurses={nurses}
          currentUserId={currentUserId}
          busy={busy}
          onClose={() => {
            if (!busy) setEditor(null)
          }}
          onSave={async (payload) => {
            await onSave(editor.roomId, payload)
            setEditor(null)
          }}
          onClear={async () => {
            await onClear(editor.roomId)
            setEditor(null)
          }}
        />
      ) : null}
    </div>
  )
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{value}</p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

function RoomCard({ room, onEdit }) {
  const ratio = room.bedsTotal > 0 ? Math.round((room.bedsOccupied / room.bedsTotal) * 100) : 0
  const state = coverageOf(room)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
      <div className="h-1.5" style={{ backgroundColor: room.zoneColor || '#d97706' }} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{room.zoneName}</p>
            <h3 className="truncate text-lg font-extrabold text-slate-900">{room.name}</h3>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
              state === 'staffed'
                ? 'bg-emerald-100 text-emerald-800'
                : state === 'partial'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-rose-100 text-rose-800'
            }`}
          >
            {state === 'staffed' ? 'Équipe complète' : state === 'partial' ? 'Sans infirmière' : 'Sans responsable'}
          </span>
        </header>

        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Occupation</span>
            <span className="tabular-nums text-slate-700">
              {room.bedsOccupied}/{room.bedsTotal} lits
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${ratio}%` }} />
          </div>
        </div>

        {room.doctor ? (
          <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-3 py-2.5">
            <span
              className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-xs font-extrabold text-white"
              aria-hidden="true"
            >
              {personInitials(room.doctor)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Responsable</p>
              <p className="truncate text-sm font-extrabold text-slate-900">{clinicianLabel(room.doctor)}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 px-3 py-3 text-sm font-semibold text-rose-800">
            Aucun médecin en charge de cette salle.
          </div>
        )}

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Infirmières</p>
          {room.nurses?.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {room.nurses.map((nurse) => (
                <li
                  key={nurse.id}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full bg-sky-50 py-1 pr-3 pl-1 text-xs font-extrabold text-sky-950"
                >
                  <span
                    className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-[10px] text-white"
                    aria-hidden="true"
                  >
                    {personInitials(nurse)}
                  </span>
                  {nurse.firstName} {nurse.lastName}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm font-semibold text-slate-500">Aucune infirmière liée.</p>
          )}
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="mt-auto min-h-11 rounded-2xl bg-slate-900 text-sm font-extrabold text-white hover:bg-slate-800"
        >
          {room.doctor ? 'Modifier l’équipe' : 'Affecter une équipe'}
        </button>
      </div>
    </article>
  )
}

function Roster({ title, people, empty, tone }) {
  const avatar =
    tone === 'sky'
      ? 'bg-gradient-to-br from-sky-500 to-blue-600'
      : 'bg-gradient-to-br from-amber-500 to-orange-600'
  return (
    <div className="mt-4">
      <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{title}</h3>
      {people.length === 0 ? (
        <p className="mt-2 text-xs font-semibold text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-2">
              <span
                className={`flex size-8 items-center justify-center rounded-full text-[10px] font-extrabold text-white ${avatar}`}
                aria-hidden="true"
              >
                {personInitials(person)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold text-slate-900">
                  {person.role === 'nurse' ? `${person.firstName} ${person.lastName}` : clinicianLabel(person)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
