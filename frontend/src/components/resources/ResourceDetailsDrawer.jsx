import { useCallback, useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'

import {
  confirmResourceReady,
  fetchResourceHistory,
  markResourceCleaning,
  setResourceOperationalStatus,
} from '@/api/resources.js'
import { ResourceStatusBadge } from '@/components/ui/StatusBadge.jsx'

function formatWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export function ResourceDetailsDrawer({ bed, canMutate = false, onClose, onUpdated }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')

  const bedId = bed?.bedId

  const loadHistory = useCallback(async () => {
    if (!bedId) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchResourceHistory(bedId, { limit: 20 })
      setHistory(data.events || [])
    } catch (e) {
      setError(e.message || 'Historique indisponible')
    } finally {
      setLoading(false)
    }
  }, [bedId])

  useEffect(() => {
    setHistory(null)
    loadHistory()
  }, [loadHistory])

  if (!bed) return null

  async function runAction(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await loadHistory()
      onUpdated?.()
    } catch (e) {
      setError(e.message || 'Action refusée')
    } finally {
      setBusy(false)
    }
  }

  const op = bed.operationalStatus || 'ready'
  const showConfirmReady = canMutate && !bed.occupied && (op === 'cleaning' || op === 'maintenance')
  const showMarkCleaning =
    canMutate && !bed.occupied && op === 'ready'
  const showMaintenance =
    canMutate && !bed.occupied && !['maintenance', 'out_of_service'].includes(op)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Fermer"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
        aria-labelledby="resource-drawer-title"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {bed.zoneName} · {bed.roomName}
            </p>
            <h2 id="resource-drawer-title" className="text-lg font-extrabold text-slate-900">
              {bed.bedLabel}
            </h2>
            <div className="mt-2">
              <ResourceStatusBadge operationalStatus={op} occupied={bed.occupied} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Fermer le détail"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {bed.occupied ? (
            <p className="text-sm text-slate-700">
              Patient{' '}
              <span className="font-bold">{bed.publicCode || `#${bed.visitId}`}</span>
              {bed.patientName ? ` · ${bed.patientName}` : ''}
            </p>
          ) : (
            <p className="text-sm text-slate-600">Aucune affectation active.</p>
          )}

          {bed.assignedAt ? (
            <p className="text-xs text-slate-500">Affecté depuis {formatWhen(bed.assignedAt)}</p>
          ) : null}

          {canMutate ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <label className="block text-xs font-bold text-slate-600" htmlFor="resource-note">
                Note (facultatif)
              </label>
              <textarea
                id="resource-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Motif ou commentaire opérationnel"
              />
              <div className="flex flex-wrap gap-2">
                {showConfirmReady ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction(() => confirmResourceReady(bedId, { note: note || undefined }))
                    }
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Confirmer nettoyage / prêt
                  </button>
                ) : null}
                {showMarkCleaning ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction(() => markResourceCleaning(bedId, { note: note || undefined }))
                    }
                    className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Déclarer nettoyage
                  </button>
                ) : null}
                {showMaintenance ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction(() =>
                        setResourceOperationalStatus(bedId, {
                          operationalStatus: 'maintenance',
                          note: note || 'Maintenance',
                        }),
                      )
                    }
                    className="rounded-xl border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-orange-800 disabled:opacity-50"
                  >
                    Maintenance
                  </button>
                ) : null}
              </div>
              {busy ? (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  Mise à jour…
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>
          ) : null}

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Historique récent</h3>
            {loading ? (
              <p className="mt-2 text-sm text-slate-500">Chargement…</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {(history || []).map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs"
                  >
                    <p className="font-bold text-slate-800">
                      {ev.fromStatus || '—'} → {ev.toStatus}
                    </p>
                    <p className="text-slate-600">{formatWhen(ev.createdAt)}</p>
                    {ev.actorName ? <p className="text-slate-500">{ev.actorName}</p> : null}
                    {ev.note ? <p className="mt-1 text-slate-600">{ev.note}</p> : null}
                  </li>
                ))}
                {!history?.length ? (
                  <li className="text-sm text-slate-500">Aucun événement enregistré.</li>
                ) : null}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}
