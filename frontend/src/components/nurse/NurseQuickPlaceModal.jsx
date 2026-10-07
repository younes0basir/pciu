import { useMemo, useState } from 'react'
import { BedDouble, Loader2, X } from 'lucide-react'

import { priorityBadgeClass } from '@/components/chief/chiefUtils.js'

export function NurseQuickPlaceModal({ open, bed, waitingPatients, busy, onClose, onConfirm }) {
  const [visitId, setVisitId] = useState('')
  const [error, setError] = useState(null)

  const candidates = useMemo(() => {
    const list = [...(waitingPatients || [])]
    list.sort((a, b) => {
      if (a.isCalled !== b.isCalled) return a.isCalled ? -1 : 1
      if (a.priority !== b.priority) return a.priority - b.priority
      return (a.queuePosition ?? 0) - (b.queuePosition ?? 0)
    })
    return list
  }, [waitingPatients])

  if (!open || !bed) return null

  async function submit(event) {
    event.preventDefault()
    setError(null)
    if (!visitId) {
      setError('Choisissez un patient en attente.')
      return
    }
    try {
      await onConfirm(Number(visitId), bed.bedId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Placement impossible.')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-sky-100 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
              <BedDouble className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Affecter un patient</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">
                {bed.zoneName} · {bed.roomName} · {bed.bedLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-xs font-extrabold text-slate-700" htmlFor="quick-place-patient">
            Patient en salle d’attente
          </label>
          {candidates.length === 0 ? (
            <p className="text-xs font-semibold text-rose-700">Aucun patient en attente disponible.</p>
          ) : (
            <select
              id="quick-place-patient"
              value={visitId}
              onChange={(event) => setVisitId(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800"
            >
              <option value="">Choisir…</option>
              {candidates.map((row) => (
                <option key={row.visitId} value={String(row.visitId)}>
                  {row.isCalled ? '★ ' : ''}P{row.priority} · {row.patientName} · {row.publicCode}
                </option>
              ))}
            </select>
          )}

          {visitId ? (
            <p className="text-[11px] font-semibold text-slate-500">
              {(() => {
                const row = candidates.find((r) => String(r.visitId) === visitId)
                if (!row) return null
                return (
                  <>
                    <span
                      className={`mr-1 inline-block rounded px-1 py-px text-[10px] font-extrabold ring-1 ring-inset ${priorityBadgeClass(row.priority)}`}
                    >
                      P{row.priority}
                    </span>
                    {row.chiefComplaint}
                  </>
                )
              })()}
            </p>
          ) : null}

          {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || !visitId || candidates.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirmer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
