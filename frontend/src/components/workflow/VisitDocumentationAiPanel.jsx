import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import {
  fetchAiStatus,
  patchAiRecommendation,
  requestDocumentationSummary,
} from '@/api/ai.js'

export function VisitDocumentationAiPanel({ visitId, disabled }) {
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(null)
  const [recommendationId, setRecommendationId] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [blockHint, setBlockHint] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const status = await fetchAiStatus()
      setBlockHint(status.documentationHint ?? null)
    } catch {
      setBlockHint('Impossible de lire l’état IA du service.')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!disabled && visitId) {
      loadStatus()
    }
  }, [disabled, visitId, loadStatus])

  async function generateDraft() {
    if (blockHint) return
    setError(null)
    setCopied(false)
    setBusy(true)
    try {
      const result = await requestDocumentationSummary(visitId)
      setDraft(result.output)
      setRecommendationId(result.recommendation?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Génération impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function rejectDraft() {
    if (!recommendationId) {
      setDraft(null)
      return
    }
    setBusy(true)
    try {
      await patchAiRecommendation(recommendationId, { status: 'rejected' })
      setDraft(null)
      setRecommendationId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejet impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function acceptDraft() {
    if (!recommendationId || !draft?.summary) return
    setBusy(true)
    try {
      await patchAiRecommendation(recommendationId, {
        status: 'accepted',
        humanDecision: 'copied_to_clipboard',
      })
      await navigator.clipboard.writeText(draft.summary)
      setCopied(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acceptation impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (disabled) return null

  const canGenerate = !statusLoading && !blockHint

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-700" aria-hidden="true" />
          <p className="text-xs font-extrabold text-violet-950">Brouillon IA (documentation)</p>
        </div>
        <button
          type="button"
          disabled={busy || !canGenerate}
          onClick={generateDraft}
          className="rounded-lg bg-violet-700 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-violet-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : 'Générer'}
        </button>
      </div>

      {statusLoading ? (
        <p className="mt-2 text-[11px] font-medium text-slate-500">Vérification du mode IA…</p>
      ) : null}

      {blockHint ? (
        <p className="mt-2 text-xs font-semibold leading-relaxed text-amber-800">{blockHint}</p>
      ) : null}

      {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}

      {draft ? (
        <div className="mt-3 space-y-2 rounded-xl border border-violet-100 bg-white p-2.5">
          <p className="text-xs font-semibold leading-relaxed text-slate-700">{draft.summary}</p>
          {draft.disclaimer ? (
            <p className="text-[10px] font-medium text-slate-500">{draft.disclaimer}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={acceptDraft}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-extrabold text-white disabled:opacity-60"
            >
              Accepter (copier)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={rejectDraft}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-700 disabled:opacity-60"
            >
              Rejeter
            </button>
          </div>
          {copied ? (
            <p className="text-[10px] font-semibold text-emerald-700">Texte copié — collez-le dans la consultation.</p>
          ) : null}
        </div>
      ) : canGenerate ? (
        <p className="mt-2 text-[11px] font-medium text-slate-500">
          Proposition non enregistrée automatiquement dans le dossier clinique.
        </p>
      ) : null}
    </div>
  )
}
