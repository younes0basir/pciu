import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BedDouble, Loader2 } from 'lucide-react'

import { fetchEligibleResources } from '@/api/resources.js'
import { EmptyState } from '@/components/ui/EmptyState.jsx'
import { cn } from '@/lib/utils.js'

export function EligibleResourcePicker({
  visitId,
  staffedOnly = false,
  selectedBedId,
  onSelect,
  onConfirm,
  confirmLabel = 'Confirmer l\'affectation',
  confirmBusy = false,
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!visitId) return
    setLoading(true)
    setError(null)
    try {
      setData(await fetchEligibleResources(visitId, { staffedOnly }))
    } catch (e) {
      setError(e.message || 'Impossible de charger les ressources')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [visitId, staffedOnly])

  useEffect(() => {
    load()
  }, [load])

  if (!visitId) {
    return <EmptyState title="Visite requise" description="Sélectionnez un patient pour proposer des lits." />
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Recherche de ressources admissibles…
      </p>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        {error}
        <button type="button" onClick={load} className="ml-2 font-bold underline">
          Réessayer
        </button>
      </div>
    )
  }

  const suggestions = data?.suggestions || []

  if (data?.summary?.state === 'none_available' || suggestions.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
        <div className="flex gap-2">
          <AlertTriangle className="size-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="font-extrabold text-amber-950">Aucune ressource disponible</p>
            <p className="mt-1 text-sm text-amber-900">
              {data?.summary?.explanation ||
                'Aucun lit prêt et libre. Escalade humaine requise — aucune affectation forcée.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Suggestions ({suggestions.length}) · ordre déterministe
      </p>
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {suggestions.map((s) => {
          const selected = Number(selectedBedId) === Number(s.bedId)
          return (
            <li key={s.bedId}>
              <button
                type="button"
                onClick={() => onSelect?.(s)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition',
                  selected
                    ? 'border-sky-400 bg-sky-50 ring-2 ring-sky-300/50'
                    : 'border-slate-200 bg-white hover:border-sky-200',
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <BedDouble className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold text-slate-900">
                    {s.bedLabel} · {s.roomName}
                  </span>
                  <span className="block text-xs text-slate-600">{s.zoneName}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {s.reasons?.join(' · ')}
                  </span>
                  {s.warnings?.length ? (
                    <span className="mt-1 block text-xs font-medium text-amber-800">
                      {s.warnings.join(' · ')}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {onConfirm && selectedBedId ? (
        <button
          type="button"
          disabled={confirmBusy}
          onClick={() => onConfirm(selectedBedId)}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {confirmBusy ? 'Affectation…' : confirmLabel}
        </button>
      ) : null}
    </div>
  )
}
