import { useState } from 'react'
import { BedDouble, Loader2 } from 'lucide-react'

import { requestBedFlowRecommend } from '@/api/ai.js'

export function VisitBedFlowAiPanel({ visitId, disabled }) {
  const [busy, setBusy] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [error, setError] = useState(null)

  async function loadSuggestion() {
    setError(null)
    setBusy(true)
    try {
      const result = await requestBedFlowRecommend(visitId)
      setSuggestion(result.output)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suggestion indisponible.')
    } finally {
      setBusy(false)
    }
  }

  if (disabled) return null

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-950">
          <BedDouble className="size-3.5" aria-hidden="true" />
          Suggestion lit (IA)
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={loadSuggestion}
          className="text-[11px] font-extrabold text-indigo-700 underline-offset-2 hover:underline disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : 'Actualiser'}
        </button>
      </div>
      {error ? <p className="mt-1 text-[11px] font-semibold text-rose-700">{error}</p> : null}
      {suggestion ? (
        <p className="mt-1 text-[11px] font-semibold text-slate-700">
          Lit #{suggestion.suggested_bed_id} — {suggestion.rationale}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-slate-500">La mise au lit reste manuelle.</p>
      )}
    </div>
  )
}
