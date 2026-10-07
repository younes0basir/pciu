import { useEffect, useId, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'

import { clinicianLabel, personInitials } from '@/components/chief/chiefUtils.js'

export function ChiefTeamDialog({ room, zoneName, clinicians, nurses, currentUserId, busy, onClose, onSave, onClear }) {
  const titleId = useId()
  const [doctorId, setDoctorId] = useState(room.doctor ? String(room.doctor.id) : '')
  const [nurseIds, setNurseIds] = useState(() => new Set((room.nurses || []).map((nurse) => String(nurse.id))))
  const [doctorQuery, setDoctorQuery] = useState('')
  const [nurseQuery, setNurseQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const filteredClinicians = useMemo(() => {
    const q = doctorQuery.trim().toLowerCase()
    return (clinicians || []).filter((person) => {
      if (!q) return true
      return `${person.firstName} ${person.lastName} ${person.email}`.toLowerCase().includes(q)
    })
  }, [clinicians, doctorQuery])

  const filteredNurses = useMemo(() => {
    const q = nurseQuery.trim().toLowerCase()
    return (nurses || []).filter((person) => {
      if (!q) return true
      return `${person.firstName} ${person.lastName} ${person.email}`.toLowerCase().includes(q)
    })
  }, [nurses, nurseQuery])

  const selectedDoctor = (clinicians || []).find((person) => String(person.id) === doctorId)
  const doctorMoves =
    selectedDoctor?.assignedRoomId && String(selectedDoctor.assignedRoomId) !== String(room.roomId)

  function toggleNurse(id) {
    setNurseIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(event) {
    event.preventDefault()
    setError(null)
    if (!doctorId) {
      setError('Choisissez le médecin responsable de cette salle.')
      return
    }
    try {
      await onSave({
        doctorId: Number(doctorId),
        nurseIds: [...nurseIds].map((id) => Number(id)),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Affectation impossible.')
    }
  }

  async function clearTeam() {
    setError(null)
    try {
      await onClear()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retrait impossible.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={() => {
          if (!busy) onClose()
        }}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="relative flex max-h-[min(92vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-700">{zoneName}</p>
            <h2 id={titleId} className="text-lg font-extrabold text-slate-900">
              {room.name}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Un responsable, et les infirmières liées à cette salle.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-5 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <fieldset className="min-w-0">
            <legend className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Responsable
            </legend>
            <input
              type="search"
              value={doctorQuery}
              onChange={(event) => setDoctorQuery(event.target.value)}
              placeholder="Rechercher un médecin"
              autoFocus
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
              {filteredClinicians.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">
                  Aucun médecin actif.
                </p>
              ) : (
                filteredClinicians.map((person) => {
                  const selected = doctorId === String(person.id)
                  const elsewhere =
                    person.assignedRoomId && String(person.assignedRoomId) !== String(room.roomId)
                  return (
                    <label
                      key={person.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 ${
                        selected
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="room-doctor"
                        value={person.id}
                        checked={selected}
                        onChange={() => setDoctorId(String(person.id))}
                        className="size-4 accent-amber-600"
                      />
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-[11px] font-extrabold text-white"
                        aria-hidden="true"
                      >
                        {personInitials(person)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold text-slate-900">
                          {clinicianLabel(person)}
                          {String(person.id) === String(currentUserId) ? ' (vous)' : ''}
                        </span>
                        <span className="block truncate text-xs font-semibold text-slate-500">
                          {elsewhere ? `Actuellement ${person.assignedRoomName}` : person.assignedRoomName ? 'Déjà sur cette salle' : 'Disponible'}
                        </span>
                      </span>
                    </label>
                  )
                })
              )}
            </div>
            {doctorMoves ? (
              <p className="mt-2 text-xs font-semibold text-amber-800">
                {clinicianLabel(selectedDoctor)} quittera {selectedDoctor.assignedRoomName}. Cette salle n’aura plus de responsable.
              </p>
            ) : null}
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Infirmières liées
            </legend>
            <input
              type="search"
              value={nurseQuery}
              onChange={(event) => setNurseQuery(event.target.value)}
              placeholder="Rechercher une infirmière"
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            />
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
              {filteredNurses.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">
                  Aucune infirmière active.
                </p>
              ) : (
                filteredNurses.map((person) => {
                  const checked = nurseIds.has(String(person.id))
                  const elsewhere =
                    person.assignedRoomId && String(person.assignedRoomId) !== String(room.roomId)
                  return (
                    <label
                      key={person.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 ${
                        checked ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleNurse(String(person.id))}
                        className="size-4 accent-sky-600"
                      />
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-[11px] font-extrabold text-white"
                        aria-hidden="true"
                      >
                        {personInitials(person)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold text-slate-900">
                          {person.firstName} {person.lastName}
                        </span>
                        <span className="block truncate text-xs font-semibold text-slate-500">
                          {elsewhere
                            ? `Sera déplacée depuis ${person.assignedRoomName}`
                            : person.assignedRoomName
                              ? 'Déjà sur cette salle'
                              : 'Disponible'}
                        </span>
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </fieldset>
        </div>

        {error ? (
          <p className="px-5 text-sm font-semibold text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {room.doctor ? (
            confirmClear ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmClear(false)}
                  className="min-h-11 rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={clearTeam}
                  className="min-h-11 rounded-2xl bg-rose-600 px-4 text-sm font-extrabold text-white disabled:opacity-60"
                >
                  Retirer l’équipe
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmClear(true)}
                className="min-h-11 rounded-2xl px-2 text-left text-sm font-bold text-rose-700 hover:underline"
              >
                Retirer l’équipe de cette salle
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="min-h-11 flex-1 rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-700 sm:flex-none"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={busy || !doctorId}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 text-sm font-extrabold text-white disabled:opacity-60 sm:flex-none"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Enregistrer l’équipe
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
